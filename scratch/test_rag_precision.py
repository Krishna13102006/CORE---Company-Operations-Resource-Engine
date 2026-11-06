import httpx
import json

ollama_url = 'http://localhost:11434/api/generate'
model_name = 'qwen2.5:1.5b'

context = """[Document: Candidate 5 Data Scientist]
Nora Patel
Data Scientist
Email: nora.patel@example.com | Phone: 555-0105
Skills
python, machine learning, deep learning, pandas, numpy, tensorflow, pytorch, sql
Experience
Data Scientist at InsightAI (2020 - Present)
Trained and evaluated deep learning models using TensorFlow and PyTorch.
Processed and cleaned large datasets using Pandas and NumPy libraries.
Wrote optimized SQL queries for extracting raw analytical data.
Education
Ph.D. in Applied Statistics - Columbia University
BS in Mathematics - UC Berkeley

---

[Document: Candidate 3 Junior Frontend Engineer]
Chloe Miller
Frontend Web Developer
Email: chloe.miller@example.com | Phone: 555-0103
Skills
javascript, typescript, react, html, css, sass, webpack, vue
Experience
Junior Web Developer at PixelCraft (2022 - Present)
Designed and built responsive user interfaces using React and Typescript.
Styled complex web components using Sass and Vanilla CSS.
Collaborated with UI/UX designers to implement pixel-perfect web pages.
Education
BS in Web Design - Boston University

---

[Document: Candidate 1 Senior Python Django Engineer]
Alexander Wright
Senior Software Engineer
Email: alexander.wright@example.com | Phone: 555-0101
Skills
python, django, aws, docker, postgresql, redis, git, rest, ci/cd
Experience
Lead Backend Engineer at DevCorp (2021 - Present)
Developed multi-tenant SaaS microservices using Django and PostgreSQL.
Designed and optimized REST APIs and caching layers with Redis.
Containerized backend services using Docker and deployed on AWS.
Education
BS in Computer Science - Stanford University
MS in Software Engineering - MIT"""

question = "Who has skills of pytorch and tensorflow?"

# Test 1: Current System Prompt
sys_prompt_1 = (
    "You are an expert internal knowledge assistant. Answer the user's question accurately using the provided documents. "
    "Be helpful, direct, and provide complete, detailed answers. Prioritize details found in the documents. "
    "If the query is related to the documents (e.g., Docker) but asks for a general definition not explicitly written, "
    "you may provide a brief helpful explanation using your general knowledge. "
    "However, if the query is completely unrelated to the documents or their topics, say exactly: "
    "\"I couldn't find information about this in your organisation's documents.\""
)

prompt_1 = f"Documents:\n{context}\n\nQuestion: {question}\n\nAnswer:"

# Test 2: Improved Precision Prompt
sys_prompt_2 = (
    "You are an expert internal knowledge assistant. Answer the user's question accurately using the provided documents. "
    "Be extremely precise. When asked about skills, experience, or attributes of individuals/candidates, "
    "carefully trace them to the specific candidate's name and document they belong to. "
    "Do NOT mix up or merge details, skills, or experiences between different candidates under any circumstances. "
    "If candidate A has a skill, do not attribute it to candidate B. "
    "Prioritize details found in the documents. If the query is related to the documents but asks for a general definition "
    "not explicitly written, you may explain it using general knowledge. "
    "Otherwise, if the answer is not in the documents, say you couldn't find information."
)

def test(sys_prompt, label):
    resp = httpx.post(
        ollama_url,
        json={
            'model':  model_name,
            'system': sys_prompt,
            'prompt': prompt_1,
            'stream': False,
            'options': {
                'temperature': 0.0,
                'num_predict': 384,
                'top_p': 0.9,
            }
        },
        timeout=30.0
    )
    print(f"\n=== {label} ===")
    print(resp.json()['response'])

test(sys_prompt_1, "Old Prompt")
test(sys_prompt_2, "Improved Precision Prompt")
