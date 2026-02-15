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

    const systemPrompt = `You are an expert radiologist AI assistant specialized in FRACTURE DETECTION from X-ray images.

CRITICAL RULES:
1. Your PRIMARY job is to detect FRACTURES: broken bones, cracks, hairline fractures, stress fractures, dislocations, bone displacement, cortical disruptions, or any bone discontinuity.
2. Be THOROUGH — look carefully at ALL bones in the image. Even subtle or hairline fractures MUST be reported.
3. If you see ANY fracture or suspected fracture → set detected=true and describe it precisely.
4. If you genuinely see NO fracture after careful examination → set detected=false.
5. If the image is not an X-ray → report "Non-medical image" with detected=false.
6. Focus your report on fractures. You may mention other observations briefly in additionalNotes, but the condition field MUST only contain fracture-related findings.
7. When in doubt, lean toward detecting a potential fracture rather than missing one — err on the side of caution.

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
              { type: "text", text: "Carefully examine this X-ray image for ANY fractures, cracks, breaks, or dislocations. Look at every bone visible. Report even subtle or hairline fractures. Name the exact fracture type and location. If there is truly no fracture visible, say 'No fracture detected'. Focus on fractures — do not diagnose diseases." },
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
