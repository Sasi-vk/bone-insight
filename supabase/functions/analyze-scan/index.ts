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

    // RULE-BASED doctor correction — overrides AI when condition keywords clearly map to a specialist
    if (analysisResult.detected && analysisResult.condition) {
      const cond = (analysisResult.condition || "").toLowerCase();
      const region = (analysisResult.affectedRegion || "").toLowerCase();
      
      const doctorRules: Array<{ keywords: string[]; regionKeywords?: string[]; doctor: string }> = [
        // Spine/vertebral → Orthopedic Spine Surgeon or Neurosurgeon
        { keywords: ["spinal", "spine", "vertebr", "lumbar", "thoracic", "cervical", "disc herniation", "spondyl", "kyphosis", "lordosis", "scoliosis"], doctor: "Orthopedic Spine Surgeon; also consult Neurosurgeon" },
        // Skull → Neurosurgeon
        { keywords: ["skull", "cranial", "intracranial"], doctor: "Neurosurgeon" },
        // Facial/jaw → Oral and Maxillofacial Surgeon
        { keywords: ["jaw", "mandib", "maxill", "facial", "zygomatic", "orbital", "nasal bone"], doctor: "Oral and Maxillofacial Surgeon" },
        // Rib with lung → Cardiothoracic Surgeon
        { keywords: ["rib", "costochondr"], regionKeywords: ["lung", "thorax", "chest", "pulmonary", "pneumothorax"], doctor: "Cardiothoracic Surgeon" },
        // Tumor/cancer/mass → Oncologist
        { keywords: ["tumor", "tumour", "osteosarcoma", "sarcoma", "malignant", "neoplasm", "cancer", "metasta", "mass", "lesion suspicious"], doctor: "Oncologist (Musculoskeletal Oncology)" },
        // Arthritis → Rheumatologist
        { keywords: ["arthritis", "rheumatoid", "osteoarthr", "synovitis", "joint inflammation", "gout", "gouty"], doctor: "Rheumatologist" },
        // Osteoporosis/metabolic bone → Endocrinologist
        { keywords: ["osteoporosis", "osteopenia", "metabolic bone", "paget"], doctor: "Endocrinologist" },
        // Bone infection → Orthopedic Surgeon + Infectious Disease
        { keywords: ["osteomyelitis", "bone infection", "septic"], doctor: "Orthopedic Surgeon; consult Infectious Disease Specialist" },
        // Growth plate / pediatric → Pediatric Orthopedic Surgeon
        { keywords: ["growth plate", "epiphyseal", "salter-harris", "pediatric", "physis"], doctor: "Pediatric Orthopedic Surgeon" },
        // Stress fracture → Sports Medicine
        { keywords: ["stress fracture", "fatigue fracture", "march fracture"], doctor: "Sports Medicine Specialist" },
        // Dislocation → Orthopedic Surgeon
        { keywords: ["dislocation", "subluxation", "luxation"], doctor: "Orthopedic Surgeon" },
        // Pelvic fracture → Orthopedic Trauma Surgeon
        { keywords: ["pelvic fracture", "pelvis fracture", "acetabul"], doctor: "Orthopedic Trauma Surgeon" },
        // Compound/open fracture → Orthopedic Trauma Surgeon
        { keywords: ["compound fracture", "open fracture", "comminuted"], doctor: "Orthopedic Trauma Surgeon" },
        // Simple bone fracture (catch-all for fractures) → Orthopedic Surgeon
        { keywords: ["fracture", "broken bone", "crack"], doctor: "Orthopedic Surgeon" },
      ];

      const combined = cond + " " + region + " " + (analysisResult.findings || "").toLowerCase();
      
      for (const rule of doctorRules) {
        const condMatch = rule.keywords.some(k => combined.includes(k));
        const regionMatch = !rule.regionKeywords || rule.regionKeywords.some(k => combined.includes(k));
        if (condMatch && regionMatch) {
          if (analysisResult.doctorType !== rule.doctor) {
            console.log(`Doctor corrected by rules: "${analysisResult.doctorType}" → "${rule.doctor}" (matched: ${rule.keywords.find(k => combined.includes(k))})`);
            analysisResult.doctorType = rule.doctor;
          }
          break;
        }
      }

      // If nothing detected → General Physician
      if (!analysisResult.detected || cond === "normal" || cond.includes("no abnormality")) {
        analysisResult.doctorType = "No specialist needed — General Physician for routine follow-up";
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
