import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert radiologist AI assistant. Analyze the provided X-ray image and return ONLY valid JSON (no markdown, no code blocks).

Your response MUST follow this exact JSON schema:
{
  "detected": boolean,
  "condition": "string - specific diagnosis name",
  "severity": "None" | "Mild" | "Moderate" | "Severe" | "Critical",
  "affectedRegion": "string - precise anatomical location",
  "findings": "string - 2-3 sentence clinical findings",
  "medication": "string - evidence-based medication suggestions",
  "doctorType": "string - the most relevant specialist based on the DETECTED CONDITION",
  "urgency": "Immediate" | "Within 24 hours" | "Within a week" | "Routine",
  "additionalNotes": "string - extra observations"
}

CRITICAL RULES FOR doctorType — You MUST recommend the specialist that is most clinically relevant to the detected condition. Use this mapping as guidance:

- Bone fracture, dislocation, ligament/tendon injury → "Orthopedic Surgeon"
- Spinal fracture, spinal cord involvement → "Orthopedic Spine Surgeon" or "Neurosurgeon"
- Suspected bone tumor, osteosarcoma, abnormal bone growth/mass → "Oncologist (Musculoskeletal Oncology)"
- Joint degeneration, arthritis, osteoporosis → "Rheumatologist"
- Bone infection (osteomyelitis) → "Infectious Disease Specialist"
- Pediatric bone fracture or growth plate injury → "Pediatric Orthopedic Surgeon"
- Stress fracture in athletes → "Sports Medicine Specialist"
- Jaw/facial bone fracture → "Oral and Maxillofacial Surgeon"
- Skull fracture, head trauma → "Neurosurgeon"
- Rib fracture with lung involvement → "Cardiothoracic Surgeon"
- Metabolic bone disease → "Endocrinologist"
- Normal/no abnormality → "General Physician for routine checkup"
- If the condition fits multiple specialties, list the primary one first, then secondary: e.g., "Orthopedic Surgeon; consult Rheumatologist if chronic"

Do NOT default to "Orthopedic Surgeon" for every case. Match the specialist to the actual pathology you detect.

If the image is not a medical X-ray, return detected=false with condition="Non-medical image uploaded" and doctorType="N/A".`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this X-ray scan. Identify the condition, determine the correct specialist based on the pathology, assess severity, and provide a clinical report." },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType || "image/png"};base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No analysis returned");

    let analysisResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      analysisResult = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error("Parse failed:", content);
      throw new Error("Failed to parse analysis");
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-scan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
