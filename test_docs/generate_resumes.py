"""
generate_resumes.py
Generates realistic test resume PDFs using reportlab.
Run with: python test_docs/generate_resumes.py  (from project root with venv active)
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Colour palette ────────────────────────────────────────────────────────────
PURPLE   = colors.HexColor('#6B46C1')
DARK     = colors.HexColor('#1E1E2E')
MID      = colors.HexColor('#4A4A5A')
LIGHT    = colors.HexColor('#F8F8FF')

# ── Base styles ───────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def make_styles():
    name_s = ParagraphStyle('Name', fontSize=20, fontName='Helvetica-Bold',
                             textColor=DARK, spaceAfter=2)
    title_s = ParagraphStyle('Title', fontSize=11, fontName='Helvetica',
                              textColor=PURPLE, spaceAfter=2)
    contact_s = ParagraphStyle('Contact', fontSize=8, fontName='Helvetica',
                                textColor=MID, spaceAfter=6)
    section_s = ParagraphStyle('Section', fontSize=10, fontName='Helvetica-Bold',
                                textColor=PURPLE, spaceBefore=10, spaceAfter=3)
    role_s = ParagraphStyle('Role', fontSize=9, fontName='Helvetica-Bold',
                             textColor=DARK, spaceAfter=1)
    sub_s = ParagraphStyle('Sub', fontSize=8, fontName='Helvetica-Oblique',
                            textColor=MID, spaceAfter=2)
    body_s = ParagraphStyle('Body', fontSize=8.5, fontName='Helvetica',
                             textColor=DARK, spaceAfter=2, leading=12)
    bullet_s = ParagraphStyle('Bullet', fontSize=8.5, fontName='Helvetica',
                               textColor=DARK, leftIndent=12, spaceAfter=1,
                               leading=12, bulletIndent=4, bulletText='•')
    return name_s, title_s, contact_s, section_s, role_s, sub_s, body_s, bullet_s

def build_pdf(filename, content_fn):
    path = os.path.join(OUT_DIR, filename)
    doc = SimpleDocTemplate(path, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    s = make_styles()
    story = content_fn(*s)
    doc.build(story)
    print(f'  [OK] {filename}')

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=PURPLE, spaceAfter=6)

def sp(h=4):
    return Spacer(1, h)

def skills_table(skills_list, cols=4):
    """Render skills as a compact wrapped table."""
    rows, row = [], []
    for i, sk in enumerate(skills_list):
        row.append(sk)
        if len(row) == cols:
            rows.append(row); row = []
    if row:
        while len(row) < cols: row.append('')
        rows.append(row)
    t = Table(rows, colWidths=[3.9*cm]*cols)
    t.setStyle(TableStyle([
        ('FONTNAME',  (0,0),(-1,-1), 'Helvetica'),
        ('FONTSIZE',  (0,0),(-1,-1), 8),
        ('TEXTCOLOR', (0,0),(-1,-1), DARK),
        ('BACKGROUND',(0,0),(-1,-1), LIGHT),
        ('ROWBACKGROUNDS',(0,0),(-1,-1),[LIGHT, colors.white]),
        ('BOX',       (0,0),(-1,-1), 0.3, PURPLE),
        ('INNERGRID', (0,0),(-1,-1), 0.2, colors.HexColor('#DDDDEE')),
        ('ALIGN',     (0,0),(-1,-1), 'CENTER'),
        ('VALIGN',    (0,0),(-1,-1), 'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1), 3),
        ('BOTTOMPADDING',(0,0),(-1,-1), 3),
    ]))
    return t


# ══════════════════════════════════════════════════════════════════════════════
# RESUME 1 — Nora Patel  (updated with Projects section)
# ══════════════════════════════════════════════════════════════════════════════
def nora_patel(name_s, title_s, contact_s, section_s, role_s, sub_s, body_s, bullet_s):
    story = []
    story += [
        Paragraph('Nora Patel', name_s),
        Paragraph('Senior Data Scientist', title_s),
        Paragraph('nora.patel@email.com  |  +1 (415) 555-0192  |  linkedin.com/in/norapatel  |  San Francisco, CA', contact_s),
        hr(),
    ]

    # Skills
    story += [Paragraph('SKILLS', section_s)]
    story += [skills_table(['Python', 'Machine Learning', 'Deep Learning', 'TensorFlow',
                             'PyTorch', 'Pandas', 'NumPy', 'Scikit-Learn',
                             'SQL', 'Spark', 'Tableau', 'Docker',
                             'AWS SageMaker', 'MLflow', 'Airflow', 'Git']), sp()]

    # Experience
    story += [Paragraph('EXPERIENCE', section_s)]
    story += [
        Paragraph('Senior Data Scientist', role_s),
        Paragraph('InsightAI, San Francisco, CA  |  2020 – Present', sub_s),
        Paragraph('• Built and deployed real-time fraud detection models (XGBoost + LSTM) reducing false positives by 38%.', bullet_s),
        Paragraph('• Led a team of 4 data scientists to deliver an NLP-powered customer churn predictor (93% AUC).', bullet_s),
        Paragraph('• Designed end-to-end ML pipelines using Apache Airflow and AWS SageMaker.', bullet_s),
        Paragraph('• Presented monthly model performance reports to C-suite stakeholders.', bullet_s),
        sp(6),
        Paragraph('Data Scientist', role_s),
        Paragraph('DataBridge Analytics, New York, NY  |  2017 – 2020', sub_s),
        Paragraph('• Developed demand forecasting models (ARIMA, Prophet) for 3 Fortune 500 retail clients.', bullet_s),
        Paragraph('• Processed and cleaned datasets of 50M+ rows using Pandas and PySpark.', bullet_s),
        Paragraph('• Built interactive dashboards in Tableau for executive reporting.', bullet_s),
        sp(6),
    ]

    # Projects
    story += [Paragraph('PROJECTS', section_s)]
    story += [
        Paragraph('Real-Time Sentiment Analysis API', role_s),
        Paragraph('• Built a FastAPI service wrapping a fine-tuned BERT model for live tweet sentiment classification.', bullet_s),
        Paragraph('• Achieved 91% accuracy on the SST-2 benchmark; containerised with Docker and deployed on AWS ECS.', bullet_s),
        sp(4),
        Paragraph('Open-Source: AutoML Benchmark Suite', role_s),
        Paragraph('• Contributed benchmark scripts comparing AutoSklearn, H2O AutoML, and TPOT across 20 datasets.', bullet_s),
        Paragraph('• Repository has 480+ GitHub stars; published findings in a Medium article (12k views).', bullet_s),
        sp(4),
        Paragraph('Kaggle — House Price Prediction (Top 4%)', role_s),
        Paragraph('• Engineered 60+ features; ensembled LightGBM, XGBoost, and Ridge to achieve RMSE of 0.118.', bullet_s),
        sp(6),
    ]

    # Education
    story += [Paragraph('EDUCATION', section_s)]
    story += [
        Paragraph('M.Sc. in Applied Statistics', role_s),
        Paragraph('Columbia University, New York, NY  |  2015 – 2017', sub_s),
        sp(4),
        Paragraph('B.Sc. in Mathematics', role_s),
        Paragraph('University of California, Berkeley  |  2011 – 2015', sub_s),
    ]
    return story


# ══════════════════════════════════════════════════════════════════════════════
# RESUME 2 — Arjun Mehta  (ML Engineer, 3 yrs exp)
# ══════════════════════════════════════════════════════════════════════════════
def arjun_mehta(name_s, title_s, contact_s, section_s, role_s, sub_s, body_s, bullet_s):
    story = []
    story += [
        Paragraph('Arjun Mehta', name_s),
        Paragraph('Machine Learning Engineer', title_s),
        Paragraph('arjun.mehta@gmail.com  |  +91 98765 43210  |  github.com/arjunml  |  Bengaluru, India', contact_s),
        hr(),
    ]

    story += [Paragraph('SKILLS', section_s)]
    story += [skills_table(['Python', 'TensorFlow', 'Keras', 'PyTorch',
                             'Scikit-Learn', 'OpenCV', 'FastAPI', 'Flask',
                             'PostgreSQL', 'Redis', 'Docker', 'Kubernetes',
                             'GCP Vertex AI', 'MLflow', 'Pandas', 'NumPy']), sp()]

    story += [Paragraph('EXPERIENCE', section_s)]
    story += [
        Paragraph('Machine Learning Engineer', role_s),
        Paragraph('Fractal Analytics, Bengaluru  |  2022 – Present', sub_s),
        Paragraph('• Built computer vision pipeline for defect detection on manufacturing lines (96.2% precision).', bullet_s),
        Paragraph('• Deployed 4 ML models as REST APIs using FastAPI + Docker on GCP Cloud Run.', bullet_s),
        Paragraph('• Reduced model inference latency by 45% through ONNX quantisation and TensorRT optimisation.', bullet_s),
        sp(6),
        Paragraph('Junior Data Scientist', role_s),
        Paragraph('Mu Sigma, Bengaluru  |  2021 – 2022', sub_s),
        Paragraph('• Analysed click-stream data for e-commerce client to identify drop-off points (15% uplift in conversions).', bullet_s),
        Paragraph('• Created weekly automated reports using Python and Jinja2 templates.', bullet_s),
        sp(6),
    ]

    story += [Paragraph('PROJECTS', section_s)]
    story += [
        Paragraph('Sign Language Recognition System (Final Year Project)', role_s),
        Paragraph('• Trained a CNN-LSTM model on Indian Sign Language dataset (2,000 video clips) achieving 88% accuracy.', bullet_s),
        Paragraph('• Integrated with a real-time webcam feed using OpenCV; demoed at national engineering symposium.', bullet_s),
        sp(4),
        Paragraph('Fake News Detector Chrome Extension', role_s),
        Paragraph('• Fine-tuned DistilBERT on LIAR dataset; packaged as a Chrome extension with 600+ installs.', bullet_s),
        Paragraph('• Backend hosted on AWS Lambda with 99.7% uptime.', bullet_s),
        sp(6),
    ]

    story += [Paragraph('EDUCATION', section_s)]
    story += [
        Paragraph('B.Tech in Computer Science & Engineering', role_s),
        Paragraph('Indian Institute of Technology, Roorkee  |  2017 – 2021', sub_s),
        Paragraph('CGPA: 8.9 / 10  |  Specialisation: Artificial Intelligence', sub_s),
    ]
    return story


# ══════════════════════════════════════════════════════════════════════════════
# RESUME 3 — Priya Sharma  (Full-Stack Engineer, 7 yrs exp)
# ══════════════════════════════════════════════════════════════════════════════
def priya_sharma(name_s, title_s, contact_s, section_s, role_s, sub_s, body_s, bullet_s):
    story = []
    story += [
        Paragraph('Priya Sharma', name_s),
        Paragraph('Senior Full-Stack Engineer', title_s),
        Paragraph('priya.sharma@outlook.com  |  +44 7700 900123  |  priyabuilds.dev  |  London, UK', contact_s),
        hr(),
    ]

    story += [Paragraph('SKILLS', section_s)]
    story += [skills_table(['React', 'TypeScript', 'Next.js', 'Node.js',
                             'Python', 'Django', 'GraphQL', 'PostgreSQL',
                             'MongoDB', 'Redis', 'AWS', 'Terraform',
                             'Docker', 'GitHub Actions', 'Tailwind CSS', 'Jest']), sp()]

    story += [Paragraph('EXPERIENCE', section_s)]
    story += [
        Paragraph('Senior Full-Stack Engineer', role_s),
        Paragraph('Monzo Bank, London  |  2021 – Present', sub_s),
        Paragraph('• Led frontend architecture for the Business Banking dashboard serving 200k+ SME customers.', bullet_s),
        Paragraph('• Migrated legacy Angular app to React + TypeScript; reduced bundle size by 52%.', bullet_s),
        Paragraph('• Implemented end-to-end testing suite with Playwright; coverage from 12% to 87%.', bullet_s),
        sp(6),
        Paragraph('Full-Stack Engineer', role_s),
        Paragraph('Deliveroo, London  |  2019 – 2021', sub_s),
        Paragraph('• Built real-time order tracking feature using WebSockets (Django Channels) for 4M daily users.', bullet_s),
        Paragraph('• Designed GraphQL API gateway consolidating 6 microservices.', bullet_s),
        sp(6),
        Paragraph('Frontend Developer', role_s),
        Paragraph('Fablr (startup), Edinburgh  |  2017 – 2019', sub_s),
        Paragraph('• Developed responsive React SPA with D3.js data visualisations for fashion analytics platform.', bullet_s),
        sp(6),
    ]

    story += [Paragraph('PROJECTS', section_s)]
    story += [
        Paragraph('OpenBudget — Personal Finance Tracker (Open Source)', role_s),
        Paragraph('• Next.js + Django REST app with Plaid bank integration; 900+ GitHub stars, 40+ contributors.', bullet_s),
        Paragraph('• Implemented OAuth2 login, CSV export, and AI-powered budget suggestions (GPT-3.5 API).', bullet_s),
        sp(4),
        Paragraph('Dev.Watch — GitHub Activity Dashboard', role_s),
        Paragraph('• Built real-time dashboard using React, GitHub GraphQL API, and Recharts for team productivity.', bullet_s),
        Paragraph('• Used by 3 engineering teams at Monzo for sprint retrospectives.', bullet_s),
        sp(6),
    ]

    story += [Paragraph('EDUCATION', section_s)]
    story += [
        Paragraph('M.Sc. in Software Engineering', role_s),
        Paragraph('University of Edinburgh  |  2015 – 2017', sub_s),
        sp(4),
        Paragraph('B.Sc. in Computer Science', role_s),
        Paragraph('University of Manchester  |  2012 – 2015', sub_s),
    ]
    return story


# ══════════════════════════════════════════════════════════════════════════════
# RESUME 4 — Marcus Johnson  (DevOps / SRE, 6 yrs exp)
# ══════════════════════════════════════════════════════════════════════════════
def marcus_johnson(name_s, title_s, contact_s, section_s, role_s, sub_s, body_s, bullet_s):
    story = []
    story += [
        Paragraph('Marcus Johnson', name_s),
        Paragraph('Senior DevOps / Site Reliability Engineer', title_s),
        Paragraph('m.johnson@protonmail.com  |  +1 (312) 555-0847  |  linkedin.com/in/marcusj-sre  |  Chicago, IL', contact_s),
        hr(),
    ]

    story += [Paragraph('SKILLS', section_s)]
    story += [skills_table(['Kubernetes', 'Docker', 'Terraform', 'Ansible',
                             'AWS', 'GCP', 'Azure', 'Jenkins',
                             'GitHub Actions', 'ArgoCD', 'Prometheus', 'Grafana',
                             'Python', 'Bash', 'Linux', 'Helm']), sp()]

    story += [Paragraph('EXPERIENCE', section_s)]
    story += [
        Paragraph('Senior Site Reliability Engineer', role_s),
        Paragraph('Stripe, Chicago (remote)  |  2021 – Present', sub_s),
        Paragraph('• Maintained 99.99% uptime for payment processing infrastructure handling $500B+ annual transactions.', bullet_s),
        Paragraph('• Automated blue-green deployments via ArgoCD + Helm; reduced deployment time from 45 min to 8 min.', bullet_s),
        Paragraph('• Led on-call rotation and authored 20+ runbooks reducing MTTR by 60%.', bullet_s),
        sp(6),
        Paragraph('DevOps Engineer', role_s),
        Paragraph('Accenture, Chicago  |  2019 – 2021', sub_s),
        Paragraph('• Migrated monolithic e-commerce platform to EKS (Kubernetes) — cut infra costs by $420k/year.', bullet_s),
        Paragraph('• Built CI/CD pipelines with Jenkins and GitHub Actions across 12 microservices.', bullet_s),
        sp(6),
        Paragraph('Cloud Infrastructure Engineer', role_s),
        Paragraph('Enovis Corp, Chicago  |  2018 – 2019', sub_s),
        Paragraph('• Managed AWS infrastructure (EC2, RDS, S3, CloudFront) for 3 SaaS products.', bullet_s),
        sp(6),
    ]

    story += [Paragraph('PROJECTS', section_s)]
    story += [
        Paragraph('K8s Cost Optimizer (Open Source)', role_s),
        Paragraph('• Python tool that analyses Kubernetes cluster resource requests vs usage and recommends rightsizing.', bullet_s),
        Paragraph('• Saved Stripe $80k/month in idle compute; 1,200+ GitHub stars.', bullet_s),
        sp(4),
        Paragraph('Homelab Kubernetes Cluster', role_s),
        Paragraph('• 5-node bare-metal k3s cluster running self-hosted Gitea, Nextcloud, Grafana and Vault.', bullet_s),
        Paragraph('• Fully automated provisioning with Terraform + Ansible; blogged the setup (25k reads).', bullet_s),
        sp(6),
    ]

    story += [Paragraph('EDUCATION', section_s)]
    story += [
        Paragraph('B.Sc. in Information Technology', role_s),
        Paragraph('University of Illinois, Chicago  |  2014 – 2018', sub_s),
        Paragraph('Certifications: AWS Solutions Architect Professional | CKA | Terraform Associate', sub_s),
    ]
    return story


# ══════════════════════════════════════════════════════════════════════════════
# RESUME 5 — Sofia Reyes  (Product Designer / UX, 4 yrs exp)
# ══════════════════════════════════════════════════════════════════════════════
def sofia_reyes(name_s, title_s, contact_s, section_s, role_s, sub_s, body_s, bullet_s):
    story = []
    story += [
        Paragraph('Sofia Reyes', name_s),
        Paragraph('Senior Product Designer (UX / UI)', title_s),
        Paragraph('sofia.reyes@design.io  |  +1 (646) 555-0374  |  sofiareyes.design  |  New York, NY', contact_s),
        hr(),
    ]

    story += [Paragraph('SKILLS', section_s)]
    story += [skills_table(['Figma', 'Adobe XD', 'Sketch', 'Protopie',
                             'User Research', 'Usability Testing', 'Wireframing', 'Design Systems',
                             'HTML', 'CSS', 'React (basic)', 'Zeplin',
                             'A/B Testing', 'Analytics', 'Storybook', 'Accessibility (WCAG)']), sp()]

    story += [Paragraph('EXPERIENCE', section_s)]
    story += [
        Paragraph('Senior Product Designer', role_s),
        Paragraph('Spotify, New York  |  2022 – Present', sub_s),
        Paragraph('• Redesigned the Podcast Discovery flow — A/B testing showed 29% increase in episode starts.', bullet_s),
        Paragraph('• Owned the design system "Encore" for the Creator Studio product (used by 800k+ podcasters).', bullet_s),
        Paragraph('• Ran 12 moderated user research sessions per quarter; synthesised insights for product roadmap.', bullet_s),
        sp(6),
        Paragraph('Product Designer', role_s),
        Paragraph('Squarespace, New York  |  2020 – 2022', sub_s),
        Paragraph('• Designed onboarding flow for new website builder; reduced time-to-first-publish by 34%.', bullet_s),
        Paragraph('• Collaborated closely with engineering to implement accessible components (WCAG AA compliant).', bullet_s),
        sp(6),
    ]

    story += [Paragraph('PROJECTS', section_s)]
    story += [
        Paragraph('MindSpace — Mental Health Mobile App (Personal Project)', role_s),
        Paragraph('• End-to-end UX/UI design: user interviews, journey maps, 120-screen Figma prototype.', bullet_s),
        Paragraph('• Usability tested with 18 participants; iterated to 4.7★ satisfaction score.', bullet_s),
        Paragraph('• Featured in Figma Community with 3,400+ duplicates.', bullet_s),
        sp(4),
        Paragraph('DesignTokens.fyi — Open Design Resource', role_s),
        Paragraph('• Curated reference site for design token best practices; 8k monthly visitors.', bullet_s),
        sp(6),
    ]

    story += [Paragraph('EDUCATION', section_s)]
    story += [
        Paragraph('Bachelor of Fine Arts — Interaction Design', role_s),
        Paragraph('School of Visual Arts, New York  |  2016 – 2020', sub_s),
        Paragraph('GPA: 3.9 / 4.0  |  Dean\'s List all semesters', sub_s),
    ]
    return story


# ══════════════════════════════════════════════════════════════════════════════
# RESUME 6 — David Kim  (Backend Engineer, 8 yrs exp)
# ══════════════════════════════════════════════════════════════════════════════
def david_kim(name_s, title_s, contact_s, section_s, role_s, sub_s, body_s, bullet_s):
    story = []
    story += [
        Paragraph('David Kim', name_s),
        Paragraph('Staff Backend Engineer', title_s),
        Paragraph('david.kim@hey.com  |  +1 (415) 555-0621  |  github.com/dkim-eng  |  Seattle, WA', contact_s),
        hr(),
    ]

    story += [Paragraph('SKILLS', section_s)]
    story += [skills_table(['Python', 'Go', 'Java', 'Rust',
                             'Django', 'FastAPI', 'gRPC', 'Kafka',
                             'PostgreSQL', 'DynamoDB', 'Redis', 'Elasticsearch',
                             'AWS', 'Microservices', 'System Design', 'CI/CD']), sp()]

    story += [Paragraph('EXPERIENCE', section_s)]
    story += [
        Paragraph('Staff Backend Engineer', role_s),
        Paragraph('Amazon (Alexa AI), Seattle  |  2020 – Present', sub_s),
        Paragraph('• Architected high-throughput intent recognition service (Go + gRPC) handling 2M requests/second.', bullet_s),
        Paragraph('• Led migration of 3 Python Django monoliths to Go microservices — 70% latency reduction.', bullet_s),
        Paragraph('• Mentored 6 junior engineers; conducted 50+ technical interviews.', bullet_s),
        sp(6),
        Paragraph('Senior Backend Engineer', role_s),
        Paragraph('Twilio, San Francisco  |  2018 – 2020', sub_s),
        Paragraph('• Built SMS delivery pipeline processing 4B messages/month using Kafka + Python consumers.', bullet_s),
        Paragraph('• Designed idempotent webhook retry system reducing duplicate deliveries by 99.2%.', bullet_s),
        sp(6),
        Paragraph('Backend Engineer', role_s),
        Paragraph('Yelp, San Francisco  |  2016 – 2018', sub_s),
        Paragraph('• Maintained core review API (Django) serving 200M monthly users.', bullet_s),
        Paragraph('• Optimised 40+ slow PostgreSQL queries; reduced p99 API latency from 2.1s to 180ms.', bullet_s),
        sp(6),
    ]

    story += [Paragraph('PROJECTS', section_s)]
    story += [
        Paragraph('Nexus — Distributed Task Queue (Open Source, Rust)', role_s),
        Paragraph('• High-performance task queue built in Rust with Redis backend; 2,800+ GitHub stars.', bullet_s),
        Paragraph('• Benchmarks show 3× throughput vs Celery on identical hardware.', bullet_s),
        sp(4),
        Paragraph('System Design Interview Guide (Technical Blog)', role_s),
        Paragraph('• Published 24 in-depth system design case studies (Notion-style DB, Twitter feed, Uber dispatch).', bullet_s),
        Paragraph('• 45k monthly readers; referenced in 3 engineering newsletters.', bullet_s),
        sp(4),
        Paragraph('FastORM — Async Python ORM Experiment', role_s),
        Paragraph('• Prototype async ORM for PostgreSQL using asyncpg with Pydantic v2 models.', bullet_s),
        sp(6),
    ]

    story += [Paragraph('EDUCATION', section_s)]
    story += [
        Paragraph('M.Sc. in Computer Science', role_s),
        Paragraph('Carnegie Mellon University, Pittsburgh  |  2014 – 2016', sub_s),
        Paragraph('Specialisation: Distributed Systems & Cloud Computing', sub_s),
        sp(4),
        Paragraph('B.Sc. in Computer Engineering', role_s),
        Paragraph('University of Washington, Seattle  |  2010 – 2014', sub_s),
    ]
    return story


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print('Generating resume PDFs...')
    build_pdf('Nora_Patel_Senior_Data_Scientist.pdf',    nora_patel)
    build_pdf('Arjun_Mehta_ML_Engineer.pdf',             arjun_mehta)
    build_pdf('Priya_Sharma_FullStack_Engineer.pdf',     priya_sharma)
    build_pdf('Marcus_Johnson_DevOps_SRE.pdf',           marcus_johnson)
    build_pdf('Sofia_Reyes_Product_Designer.pdf',        sofia_reyes)
    build_pdf('David_Kim_Staff_Backend_Engineer.pdf',    david_kim)
    print(f'\nAll 6 resumes saved to: {OUT_DIR}')
