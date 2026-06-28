import{s as a}from"./index-Dy7FRAUh.js";const w=(e,o,i,u,s)=>`You are a senior litigator with 25 years of experience drafting winning motions in federal and state courts. You write with precision, authority, and strategic clarity.

CASE FACTS:
Case Name: ${e.name}
Case Type: ${e.case_type}
Client: ${e.client_name}
Representation: ${e.representation}
Court/Jurisdiction: ${i?.jurisdiction??"Federal District Court"}
Case Number: ${i?.case_number??"[CASE NUMBER]"}
Judge: ${i?.judge_name??"[JUDGE NAME]"}
Plaintiff: ${i?.plaintiff_name??e.client_name}
Defendant: ${i?.defendant_name??"[DEFENDANT]"}
Case Theory: ${e.case_theory??"Not specified"}
Key Issues: ${e.key_issues?.join(", ")??"Not specified"}
Winning Factors: ${e.winning_factors?.join(", ")??"Not specified"}

DOCUMENT EVIDENCE AVAILABLE:
${o.slice(0,8).map(t=>{const n=[`• ${t.name}`];return t.summary&&n.push(`  Summary: ${t.summary}`),t.key_facts?.length&&n.push(`  Key Facts: ${t.key_facts.join("; ")}`),t.favorable_findings?.length&&n.push(`  Favorable: ${t.favorable_findings.join("; ")}`),n.join(`
`)}).join(`
`)}

MOTION TO DRAFT: ${u}
${s?`ADDITIONAL INSTRUCTIONS: ${s}`:""}

DRAFTING REQUIREMENTS:
1. Write a complete, court-ready motion — not a template or outline
2. All case-specific facts must be integrated into the argument
3. Every legal proposition must cite authority (cases, statutes, rules)
4. Structure: Caption → Introduction → Statement of Facts → Legal Standard → Argument → Conclusion → Certificate of Service
5. Arguments must be IRAC format (Issue, Rule, Application, Conclusion)
6. For § 1983 cases: address qualified immunity, constitutional standards, and circuit-specific precedent
7. Include verification flags for any facts that need attorney confirmation
8. Write as if filing tomorrow — be specific, cite record evidence, make it persuasive

Respond with ONLY valid JSON:
{
  "caption": {
    "court": "Court name",
    "case_number": "Case number",
    "plaintiff": "Plaintiff name(s)",
    "defendant": "Defendant name(s)",
    "judge": "Judge name",
    "document_title": "MOTION TITLE IN CAPS"
  },
  "sections": [
    {
      "title": "Section heading",
      "content": "Full section text",
      "type": "introduction|facts|standard|argument|conclusion|certificate",
      "subsections": [
        {
          "heading": "I. MAIN ARGUMENT HEADING",
          "content": "Full argument text with citations"
        }
      ]
    }
  ],
  "verification_flags": [
    "Verify: [specific fact or citation that needs attorney review]"
  ]
}`;async function A(e,o,i,u){const{data:{user:s},error:t}=await a.auth.getUser();if(t||!s)throw new Error("Not authenticated");const{data:n,error:d}=await a.from("cases").select("*").eq("id",e).single();if(d)throw new Error(`Failed to fetch case: ${d.message}`);const{data:h}=await a.from("case_context").select("*").eq("case_id",e).maybeSingle(),{data:y,error:m}=await a.from("documents").select("id, name, summary, key_facts, favorable_findings, adverse_findings, ocr_text").eq("case_id",e).order("created_at",{ascending:!1}).limit(10);if(m)throw new Error(`Failed to fetch documents: ${m.message}`);const _=w(n,y??[],h,o,i??""),E=`Please draft a complete, court-ready ${o} for this case. Make it specific to the facts, fully argued, and ready to file after attorney review.`,{data:r,error:l}=await a.functions.invoke("chat",{body:{messages:[{role:"system",content:_},{role:"user",content:E}]}});if(l)throw new Error(`Chat function error: ${l.message}`);let c;try{const f=typeof r=="string"?r:r?.content??r?.message??r?.choices?.[0]?.message?.content??JSON.stringify(r),p=f.match(/```(?:json)?\s*([\s\S]*?)```/)??f.match(/(\{[\s\S]*\})/),N=p?p[1]:f;c=JSON.parse(N.trim())}catch(f){throw new Error(`Failed to parse motion JSON response: ${f}`)}const{error:g}=await a.from("generated_motions").insert({case_id:e,user_id:s.id,motion_type:o,caption:c.caption,sections:c.sections,verification_flags:c.verification_flags??[],custom_instructions:i??null,status:"draft"});return g&&console.error("Failed to save generated motion:",g),c}export{A as g};
