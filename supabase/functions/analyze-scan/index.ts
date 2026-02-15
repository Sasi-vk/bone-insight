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

    const systemPrompt = `You are an expert radiologist AI assistant. Your SOLE PURPOSE is FRACTURE DETECTION in X-ray images. You are NOT a general disease diagnostic tool.

CRITICAL RULES:
1. You MUST ONLY detect FRACTURES (broken bones, cracks, stress fractures, dislocations, bone displacement).
2. You must NEVER diagnose diseases (no arthritis, no osteoporosis, no tumors, no infections, no metabolic conditions).
3. If you see a fracture → report the EXACT fracture type and location.
4. If you see NO fracture → report "No fracture detected" with detected=false.
5. If the image is not an X-ray → report "Non-medical image" with detected=false.

Return ONLY valid JSON (no markdown, no code blocks) following this schema:
{
  "detected": boolean (true ONLY if a FRACTURE is found),
  "condition": "string - MUST be a fracture type, e.g. 'Transverse Fracture', 'Oblique Fracture', 'Comminuted Fracture', 'Spiral Fracture', 'Greenstick Fracture', 'Hairline Fracture', 'Stress Fracture', 'Avulsion Fracture', 'Compression Fracture', 'Pathological Fracture', 'Dislocation'. NEVER write a disease name here.",
  "severity": "None" | "Mild" | "Moderate" | "Severe" | "Critical",
  "affectedRegion": "string - precise bone and side, e.g. 'Left Distal Radius', 'Right Proximal Femur', 'L4 Vertebral Body'",
  "findings": "string - 2-3 sentences describing the fracture pattern, displacement, angulation, and bone alignment",
  "medication": "string - pain management and fracture-appropriate medication only (e.g. analgesics, anti-inflammatories, calcium supplements)",
  "doctorType": "string - the specialist for THIS fracture (see rules below)",
  "urgency": "Immediate" | "Within 24 hours" | "Within a week" | "Routine",
  "additionalNotes": "string - follow-up recommendations, immobilization needs, surgical vs conservative treatment notes"
}

## DOCTOR RECOMMENDATION RULES FOR FRACTURES ONLY:

- Simple fracture (arm, leg, wrist, ankle, hand, foot) → "Orthopedic Surgeon"
- Compound/open/comminuted fracture → "Orthopedic Trauma Surgeon"
- Pelvic/acetabular fracture → "Orthopedic Trauma Surgeon"
- Spinal/vertebral fracture → "Orthopedic Spine Surgeon; also consult Neurosurgeon"
- Skull fracture → "Neurosurgeon"
- Facial/jaw/mandible fracture → "Oral and Maxillofacial Surgeon"
- Rib fracture → "Orthopedic Surgeon" (if lung involvement: "Cardiothoracic Surgeon")
- Growth plate fracture in children → "Pediatric Orthopedic Surgeon"
- Stress fracture → "Sports Medicine Specialist"
- Dislocation → "Orthopedic Surgeon"
- No fracture detected → "No specialist needed — General Physician for routine follow-up"
- Non-medical image → "N/A"

REMEMBER: You are a FRACTURE PREDICTION SYSTEM. Detect fractures, NOT diseases.`;

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
              { type: "text", text: "You are a FRACTURE PREDICTION system. Look at this X-ray and detect ONLY fractures (broken bones, cracks, dislocations). Do NOT diagnose diseases like arthritis, osteoporosis, or tumors. If there is a fracture, name the EXACT fracture type (e.g. 'Oblique Fracture of Distal Tibia') and recommend the correct fracture specialist. If no fracture is found, say 'No fracture detected'." },
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

    // DISEASE FILTER: If AI returned a disease instead of a fracture, override it
    if (analysisResult.detected && analysisResult.condition) {
      const cond = (analysisResult.condition || "").toLowerCase();
      const region = (analysisResult.affectedRegion || "").toLowerCase();
      const combined = cond + " " + region + " " + (analysisResult.findings || "").toLowerCase();

      const diseaseTerms = ["arthritis", "osteoarthr", "rheumatoid", "osteoporosis", "osteopenia", "tumor", "tumour", "cancer", "sarcoma", "neoplasm", "malignant", "metasta", "osteomyelitis", "infection", "septic", "gout", "paget", "rickets", "spondylosis", "degenerative", "inflammation", "synovitis", "bursitis", "tendinitis", "carpal tunnel", "plantar fasciitis"];
      
      const isDiseaseNotFracture = diseaseTerms.some(d => cond.includes(d)) && !cond.includes("fracture") && !cond.includes("broken") && !cond.includes("crack") && !cond.includes("dislocation");

      if (isDiseaseNotFracture) {
        console.log(`Disease filtered out: "${analysisResult.condition}" — fracture-only system`);
        analysisResult.detected = false;
        analysisResult.condition = "No fracture detected";
        analysisResult.severity = "None";
        analysisResult.doctorType = "General Physician for further evaluation";
        analysisResult.urgency = "Routine";
        analysisResult.medication = "No fracture-specific medication needed";
        analysisResult.additionalNotes = "The scan may show a non-fracture condition. This system detects fractures only. Please consult a General Physician for comprehensive evaluation.";
      } else {
        // Fracture detected — apply fracture-specific doctor rules
        const doctorRules: Array<{ keywords: string[]; regionKeywords?: string[]; doctor: string }> = [
          { keywords: ["spinal", "spine", "vertebr", "lumbar", "thoracic", "cervical"], doctor: "Orthopedic Spine Surgeon; also consult Neurosurgeon" },
          { keywords: ["skull", "cranial"], doctor: "Neurosurgeon" },
          { keywords: ["jaw", "mandib", "maxill", "facial", "zygomatic", "orbital", "nasal bone"], doctor: "Oral and Maxillofacial Surgeon" },
          { keywords: ["rib"], regionKeywords: ["lung", "pneumothorax", "pulmonary"], doctor: "Cardiothoracic Surgeon" },
          { keywords: ["growth plate", "epiphyseal", "salter-harris", "physis"], doctor: "Pediatric Orthopedic Surgeon" },
          { keywords: ["stress fracture", "fatigue fracture", "hairline"], doctor: "Sports Medicine Specialist" },
          { keywords: ["dislocation", "subluxation"], doctor: "Orthopedic Surgeon" },
          { keywords: ["pelvic", "pelvis", "acetabul"], doctor: "Orthopedic Trauma Surgeon" },
          { keywords: ["compound", "open fracture", "comminuted"], doctor: "Orthopedic Trauma Surgeon" },
          { keywords: ["fracture", "broken", "crack"], doctor: "Orthopedic Surgeon" },
        ];

        for (const rule of doctorRules) {
          const condMatch = rule.keywords.some(k => combined.includes(k));
          const regionMatch = !rule.regionKeywords || rule.regionKeywords.some(k => combined.includes(k));
          if (condMatch && regionMatch) {
            if (analysisResult.doctorType !== rule.doctor) {
              console.log(`Doctor corrected: "${analysisResult.doctorType}" → "${rule.doctor}"`);
              analysisResult.doctorType = rule.doctor;
            }
            break;
          }
        }
      }
    }

    if (!analysisResult.detected) {
      analysisResult.doctorType = analysisResult.doctorType || "No specialist needed — General Physician for routine follow-up";
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
