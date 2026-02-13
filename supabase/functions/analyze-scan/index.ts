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

    const systemPrompt = `You are an expert radiologist AI assistant specializing in bone and skeletal imaging. Analyze the provided X-ray image and return ONLY valid JSON (no markdown, no code blocks).

Your response MUST follow this exact JSON schema:
{
  "detected": boolean,
  "condition": "string - specific diagnosis name (e.g. 'Transverse Fracture of Distal Radius', 'Osteoarthritis of Right Knee')",
  "severity": "None" | "Mild" | "Moderate" | "Severe" | "Critical",
  "affectedRegion": "string - precise anatomical location with laterality (e.g. 'Left Distal Femur', 'Right Proximal Humerus')",
  "findings": "string - 2-3 sentence detailed clinical findings describing what you observe in the image",
  "medication": "string - evidence-based medication suggestions appropriate for the condition",
  "doctorType": "string - the EXACT specialist needed for THIS specific condition (see rules below)",
  "urgency": "Immediate" | "Within 24 hours" | "Within a week" | "Routine",
  "additionalNotes": "string - extra clinical observations, precautions, or follow-up recommendations"
}

## DOCTOR RECOMMENDATION RULES — THIS IS THE MOST IMPORTANT PART

You MUST recommend the specialist that DIRECTLY treats the detected condition. NEVER default to a generic doctor. Follow this decision tree:

FRACTURES & TRAUMA:
- Simple bone fracture (arm, leg, wrist, ankle, hand, foot) → "Orthopedic Surgeon"
- Compound/open fracture requiring surgery → "Orthopedic Trauma Surgeon"
- Pelvic fracture → "Orthopedic Trauma Surgeon"
- Spinal/vertebral fracture → "Orthopedic Spine Surgeon or Neurosurgeon"
- Skull fracture → "Neurosurgeon"
- Facial/jaw fracture → "Oral and Maxillofacial Surgeon"
- Rib fracture with suspected lung injury → "Cardiothoracic Surgeon"
- Growth plate injury in children → "Pediatric Orthopedic Surgeon"
- Stress fracture in athlete → "Sports Medicine Specialist"

JOINT & DEGENERATIVE:
- Osteoarthritis, rheumatoid arthritis → "Rheumatologist"
- Joint dislocation → "Orthopedic Surgeon"
- Severe joint degeneration needing replacement → "Orthopedic Joint Replacement Surgeon"

BONE DISEASES:
- Osteoporosis, metabolic bone disease → "Endocrinologist"
- Bone infection (osteomyelitis) → "Orthopedic Surgeon; consult Infectious Disease Specialist"
- Bone tumor, osteosarcoma, abnormal mass → "Oncologist (Musculoskeletal Oncology)"
- Paget's disease → "Endocrinologist"

SOFT TISSUE (visible on X-ray):
- Ligament/tendon avulsion fracture → "Orthopedic Surgeon; consult Sports Medicine"

NO ABNORMALITY:
- Normal scan → "No specialist consultation needed — General Physician for routine follow-up"

NON-MEDICAL IMAGE:
- Not an X-ray → detected=false, condition="Non-medical image uploaded", doctorType="N/A"

IMPORTANT: If the condition spans multiple specialties, format as: "Primary Specialist; also consult Secondary Specialist"
Example: "Orthopedic Spine Surgeon; also consult Neurologist for nerve assessment"

Analyze the ACTUAL pathology visible in the image and match it precisely to the correct specialist. Your doctor recommendation must logically follow from your diagnosis.`;

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
              { type: "text", text: "Analyze this X-ray scan carefully. First identify the EXACT condition and affected bone/region. Then based ONLY on the detected pathology, recommend the PRECISE specialist doctor — do NOT default to Orthopedic Surgeon unless it's specifically a bone fracture. Assess severity and provide a complete clinical report." },
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

    // Validation: run a second quick call to verify doctor recommendation
    if (analysisResult.detected && analysisResult.condition && analysisResult.doctorType) {
      try {
        const validationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: `Given this diagnosis from an X-ray scan:
- Condition: "${analysisResult.condition}"
- Affected Region: "${analysisResult.affectedRegion}"
- Severity: "${analysisResult.severity}"

The current doctor recommendation is: "${analysisResult.doctorType}"

Is this the CORRECT specialist for this specific condition? If NOT, provide the correct one. Use these rules:
- Simple bone fracture → Orthopedic Surgeon
- Spinal fracture → Orthopedic Spine Surgeon or Neurosurgeon
- Skull fracture → Neurosurgeon
- Facial/jaw fracture → Oral and Maxillofacial Surgeon
- Rib fracture + lung injury → Cardiothoracic Surgeon
- Children's fracture/growth plate → Pediatric Orthopedic Surgeon
- Stress fracture in athletes → Sports Medicine Specialist
- Arthritis/osteoarthritis → Rheumatologist
- Osteoporosis → Endocrinologist
- Bone tumor/mass → Oncologist (Musculoskeletal Oncology)
- Bone infection → Orthopedic Surgeon; consult Infectious Disease Specialist
- No abnormality → General Physician

Reply with ONLY valid JSON: {"correct": true/false, "recommendedDoctor": "the correct specialist"}`,
              },
            ],
          }),
        });

        if (validationResponse.ok) {
          const valData = await validationResponse.json();
          const valContent = valData.choices?.[0]?.message?.content;
          if (valContent) {
            try {
              const valMatch = valContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, valContent];
              const validation = JSON.parse(valMatch[1].trim());
              if (!validation.correct && validation.recommendedDoctor) {
                console.log(`Doctor corrected: "${analysisResult.doctorType}" → "${validation.recommendedDoctor}"`);
                analysisResult.doctorType = validation.recommendedDoctor;
              }
            } catch { /* keep original if validation parse fails */ }
          }
        }
      } catch (e) {
        console.error("Validation step failed, keeping original:", e);
      }
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
