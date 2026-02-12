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

    const systemPrompt = `You are an expert radiologist AI assistant specialized in analyzing X-ray images for bone fractures and abnormalities.

Analyze the provided X-ray image and return a JSON response with EXACTLY this structure (no markdown, no code blocks, just pure JSON):
{
  "detected": true/false,
  "condition": "Name of detected condition (e.g., 'Distal Radius Fracture', 'Hairline Fracture', 'No abnormality detected')",
  "severity": "Mild" | "Moderate" | "Severe" | "Critical" | "None",
  "affectedRegion": "Specific anatomical region (e.g., 'Distal third of right radius bone')",
  "findings": "Detailed radiological findings in 2-3 sentences describing what you observe in the X-ray",
  "medication": "Suggested medications (e.g., 'NSAIDs (Ibuprofen 400mg), Calcium supplements, Vitamin D3'). If no condition, say 'No medication required'",
  "doctorType": "Specialist to consult (e.g., 'Orthopedic Surgeon', 'Oncologist', 'Rheumatologist'). If no condition, say 'General Physician for routine checkup'",
  "urgency": "Immediate" | "Within 24 hours" | "Within a week" | "Routine",
  "additionalNotes": "Any additional observations or recommendations in 1-2 sentences"
}

IMPORTANT: 
- Return ONLY valid JSON, no other text
- Be thorough but concise in your analysis
- Always recommend consulting a real doctor
- If the image is not a medical scan, still return the JSON structure with detected=false and appropriate messages`;

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
              { type: "text", text: "Analyze this X-ray scan for bone fractures, abnormalities, and any pathological findings. Provide a comprehensive medical report." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/png"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("No analysis content returned");

    // Parse the JSON from the AI response
    let analysisResult;
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      analysisResult = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse analysis results");
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
