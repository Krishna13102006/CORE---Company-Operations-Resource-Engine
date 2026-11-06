import React, { useState, useMemo, useRef } from 'react';
import { api, extractErrorMessage } from '../../lib/api';
import { useCoreModal } from '../../context/ModalContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
  Download,
  RefreshCw,
  Send,
  Loader2,
  Table as TableIcon,
  Layers,
  HelpCircle,
  ChevronRight,
  Zap
} from 'lucide-react';

interface ColumnMeta {
  name: string;
  data_type: string;
  description?: string;
}

interface KPIItem {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface RecommendedChart {
  title: string;
  chart_type: 'bar' | 'line' | 'pie' | 'area';
  description?: string;
  x_key: string;
  y_key: string;
  aggregation?: string;
  data: Array<{ label: string; value: number }>;
}

interface AnalysisResult {
  dataset_type: string;
  summary_title: string;
  executive_summary: string;
  row_count: number;
  columns: ColumnMeta[];
  kpis: KPIItem[];
  key_insights: string[];
  anomalies_and_warnings: string[];
  recommended_charts: RecommendedChart[];
}

const SAMPLE_DATASETS = [
  {
    id: 'sales_pipeline',
    name: '🚀 SaaS Sales & Closed Revenue',
    description: 'Monthly CRM export with deal sizes, account executives, and regional performance.',
    csv: `Month,Region,Account_Executive,Product_Tier,Deal_Size_USD,Win_Status,Sales_Cycle_Days
Jan,North America,Sarah Jenkins,Enterprise,45000,Won,32
Jan,Europe,Marcus Vance,Pro,18500,Won,21
Jan,Asia-Pacific,Aiko Tanaka,Enterprise,52000,Won,45
Feb,North America,Sarah Jenkins,Starter,6000,Won,14
Feb,Europe,Marcus Vance,Enterprise,68000,Won,38
Feb,Latin America,Carlos Silva,Pro,22000,Won,29
Mar,North America,David Kim,Enterprise,95000,Won,41
Mar,Europe,Marcus Vance,Pro,24000,Won,25
Mar,Asia-Pacific,Aiko Tanaka,Pro,28500,Won,28
Apr,North America,Sarah Jenkins,Enterprise,72000,Won,35
Apr,Latin America,Carlos Silva,Starter,7500,Won,12
Apr,Asia-Pacific,Aiko Tanaka,Enterprise,84000,Won,49
May,North America,David Kim,Pro,31000,Won,20
May,Europe,Marcus Vance,Enterprise,59000,Won,34
May,Asia-Pacific,Aiko Tanaka,Pro,26000,Won,22
Jun,North America,Sarah Jenkins,Enterprise,110000,Won,44
Jun,Europe,Marcus Vance,Pro,29000,Won,19
Jun,Latin America,Carlos Silva,Enterprise,64000,Won,39`
  },
  {
    id: 'marketing_roi',
    name: '🎯 Ad Campaigns & Channel ROI',
    description: 'Multi-channel digital ads breakdown with spend, clicks, conversions, and CAC.',
    csv: `Campaign_Name,Channel,Ad_Spend_USD,Impressions,Clicks,Conversions,CAC_USD
Google Search - Enterprise,Google Ads,14500,320000,8400,210,69.05
LinkedIn InMail - CTOs,LinkedIn,18200,95000,2900,145,125.52
Meta Retargeting - Demo,Meta Ads,6800,450000,9200,180,37.78
YouTube Video Pre-Roll,YouTube,9400,680000,4100,65,144.62
Twitter / X Developer Ads,Twitter,4200,210000,3100,52,80.77
Newsletter Sponsorship,Email Media,5500,120000,4800,115,47.83
SEO Content Pillar,Organic,3000,890000,24000,420,7.14
Affiliate Partner Program,Partnerships,8100,190000,6200,195,41.54`
  },
  {
    id: 'cloud_spend',
    name: '🏢 Departmental Software & Cloud Spend',
    description: 'Corporate vendor billing, license allocations, and monthly cloud consumption.',
    csv: `Vendor,Department,Category,Monthly_Cost_USD,Active_Seats,Renewal_Quarter
Amazon Web Services,Engineering,Cloud Hosting,16800,45,Q4
Snowflake Data Warehouse,Data Science,Infrastructure,8400,18,Q3
Salesforce CRM,Sales,Business Operations,12500,35,Q1
GitHub Enterprise,Engineering,Developer Tools,4200,50,Q2
Figma Design Systems,Product & Design,Design Tools,2900,22,Q2
Slack Enterprise Grid,All Company,Communication,3800,120,Q4
Google Workspace,All Company,Productivity,4600,120,Q1
OpenAI API Platform,AI & Research,Machine Learning,9800,15,Monthly
HubSpot Marketing Hub,Marketing,Marketing Automation,6100,12,Q3
Datadog Monitoring,DevOps,Observability,7300,25,Q4`
  }
];

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

export const SpreadsheetAnalyst: React.FC = () => {
  const { alert: coreAlert } = useCoreModal();
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active sub-view in Analyst
  const [viewTab, setViewTab] = useState<'insights' | 'studio' | 'table' | 'qa'>('insights');

  // Interactive Chart Studio Controls
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'area'>('bar');
  const [selectedX, setSelectedX] = useState<string>('');
  const [selectedY, setSelectedY] = useState<string>('');
  const [aggregation, setAggregation] = useState<'sum' | 'avg' | 'count' | 'max' | 'min'>('sum');
  const [chartTitle, setChartTitle] = useState<string>('Custom Visualizer');

  // Natural Language Q&A State
  const [qaQuery, setQaQuery] = useState<string>('');
  const [qaHistory, setQaHistory] = useState<Array<{ query: string; answer: string; findings: string[]; action?: string }>>([]);
  const [qaLoading, setQaLoading] = useState<boolean>(false);

  // Table Search & Pagination
  const [tableSearch, setTableSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedData = useMemo(() => {
    if (!csvContent) return { headers: [], rows: [] };
    return parseCSV(csvContent);
  }, [csvContent]);

  const numericColumns = useMemo(() => {
    if (parsedData.rows.length === 0) return [];
    return parsedData.headers.filter(h => {
      const sample = parsedData.rows.slice(0, 15).map(r => r[h]);
      const validNums = sample.filter(v => v !== '' && !isNaN(Number(v.replace(/[$,]/g, ''))));
      return validNums.length > sample.length * 0.6;
    });
  }, [parsedData]);

  const categoricalColumns = useMemo(() => {
    return parsedData.headers.filter(h => !numericColumns.includes(h));
  }, [parsedData, numericColumns]);

  const initializeChartDefaults = (headers: string[], numCols: string[], catCols: string[], recommended?: RecommendedChart[]) => {
    if (recommended && recommended.length > 0) {
      const firstRec = recommended[0];
      setChartTitle(firstRec.title);
      setChartType(firstRec.chart_type || 'bar');
      setSelectedX(firstRec.x_key);
      setSelectedY(firstRec.y_key);
      setAggregation((firstRec.aggregation as any) || 'sum');
      return;
    }

    if (catCols.length > 0) {
      setSelectedX(catCols[0]);
    } else if (headers.length > 0) {
      setSelectedX(headers[0]);
    }

    if (numCols.length > 0) {
      setSelectedY(numCols[0]);
    } else if (headers.length > 1) {
      setSelectedY(headers[1]);
    }
    setChartTitle('Dataset Metrics Overview');
  };

  const runAnalysis = async (content: string, name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await api.post('/expenses/analyze-sheet/', {
        csv_text: content,
        filename: name
      });
      setAnalysis(resp);
      const parsed = parseCSV(content);
      const numCols = parsed.headers.filter(h => {
        const sample = parsed.rows.slice(0, 15).map(r => r[h]);
        return sample.filter(v => v !== '' && !isNaN(Number(v.replace(/[$,]/g, '')))).length > sample.length * 0.6;
      });
      const catCols = parsed.headers.filter(h => !numCols.includes(h));
      initializeChartDefaults(parsed.headers, numCols, catCols, resp.recommended_charts);
      setViewTab('insights');
    } catch (err: any) {
      setError(extractErrorMessage(err) || 'Failed to analyze spreadsheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvContent(text);
        runAnalysis(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = (sample: typeof SAMPLE_DATASETS[0]) => {
    setFileName(sample.name);
    setCsvContent(sample.csv);
    runAnalysis(sample.csv, sample.name);
  };

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaQuery.trim() || !csvContent) return;

    setQaLoading(true);
    const currentQ = qaQuery;
    setQaQuery('');

    try {
      const resp = await api.post('/expenses/query-sheet/', {
        csv_text: csvContent,
        query: currentQ
      });
      setQaHistory(prev => [
        {
          query: currentQ,
          answer: resp.answer,
          findings: resp.key_findings || [],
          action: resp.recommended_action
        },
        ...prev
      ]);
      setViewTab('qa');
    } catch (err: any) {
      coreAlert({
        title: 'Query Failed',
        description: extractErrorMessage(err) || 'Failed to query spreadsheet data.',
        variant: 'destructive',
      });
    } finally {
      setQaLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!selectedX || !parsedData.rows.length) return [];

    const grouped: Record<string, { sum: number; count: number; max: number; min: number }> = {};

    parsedData.rows.forEach(r => {
      const xVal = r[selectedX]?.trim() || 'Unknown';
      const rawY = selectedY ? parseFloat(r[selectedY]?.replace(/[$,]/g, '')) : 1;
      const yVal = isNaN(rawY) ? 1 : rawY;

      if (!grouped[xVal]) {
        grouped[xVal] = { sum: yVal, count: 1, max: yVal, min: yVal };
      } else {
        grouped[xVal].sum += yVal;
        grouped[xVal].count += 1;
        grouped[xVal].max = Math.max(grouped[xVal].max, yVal);
        grouped[xVal].min = Math.min(grouped[xVal].min, yVal);
      }
    });

    const result = Object.keys(grouped).map(label => {
      const g = grouped[label];
      let val = g.sum;
      if (aggregation === 'avg') val = g.sum / (g.count || 1);
      else if (aggregation === 'count') val = g.count;
      else if (aggregation === 'max') val = g.max;
      else if (aggregation === 'min') val = g.min;

      return {
        label,
        value: Math.round(val * 100) / 100
      };
    });

    return result.sort((a, b) => b.value - a.value).slice(0, 15);
  }, [parsedData, selectedX, selectedY, aggregation]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map(d => d.value), 1);
  }, [chartData]);

  const filteredRows = useMemo(() => {
    if (!tableSearch.trim()) return parsedData.rows;
    const query = tableSearch.toLowerCase();
    return parsedData.rows.filter(r =>
      Object.values(r).some(val => val.toLowerCase().includes(query))
    );
  }, [parsedData.rows, tableSearch]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage]);

  const chartColors = [
    '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#14b8a6'
  ];

  return (
    <div className="space-y-6">
      {/* Top Controls & Uploader */}
      <Card className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl overflow-hidden">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              AI Spreadsheet & CSV Data Analyst
            </h3>
            <p className="text-xs text-muted-foreground">
              Drop any CSV file or choose a preset business template to get instant Gemini executive summaries, interactive charts, and natural language Q&A.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,text/csv"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-sm h-9"
            >
              <UploadCloud className="h-4 w-4" />
              Upload CSV File
            </Button>

            {csvContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAnalysis(csvContent, fileName)}
                disabled={isLoading}
                className="text-xs font-semibold gap-1.5 h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Re-Analyze
              </Button>
            )}
          </div>
        </div>

        {/* Preset Sample Templates Banner */}
        <div className="p-4 bg-slate-100/60 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Try Sample Datasets:
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            {SAMPLE_DATASETS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleLoadSample(sample)}
                className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-border hover:border-primary text-slate-800 dark:text-slate-200 font-medium transition-all shadow-2xs hover:shadow-xs flex items-center gap-1"
              >
                <span>{sample.name}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="p-12 text-center bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Gemini is analyzing your spreadsheet...</h4>
              <p className="text-xs text-muted-foreground">Extracting KPIs, detecting statistical anomalies, and preparing visualizations.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Area */}
      {!isLoading && csvContent && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Sub-Navigation Tabs */}
          <div className="flex border border-border rounded-xl p-1 bg-white dark:bg-slate-900 shadow-xs text-xs font-semibold max-w-fit">
            <button
              onClick={() => setViewTab('insights')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewTab === 'insights'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Executive Summary
            </button>

            <button
              onClick={() => setViewTab('studio')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewTab === 'studio'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Interactive Multi-Chart Studio
            </button>

            <button
              onClick={() => setViewTab('table')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewTab === 'table'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              Raw Data Table ({parsedData.rows.length})
            </button>

            <button
              onClick={() => setViewTab('qa')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewTab === 'qa'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Ask AI (Q&A)
            </button>
          </div>

          {/* Sub-Tab 1: AI Summary */}
          {viewTab === 'insights' && analysis && (
            <div className="space-y-6">
              <Card className="bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent border border-primary/20 shadow-sm rounded-2xl p-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30">
                      {analysis.dataset_type || 'Business Intelligence'}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {analysis.row_count} total records analyzed
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {analysis.summary_title}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                    {analysis.executive_summary}
                  </p>
                </div>
              </Card>

              {analysis.kpis && analysis.kpis.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {analysis.kpis.map((kpi, idx) => (
                    <Card key={idx} className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-xl p-4 flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        {kpi.label}
                      </span>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                          {kpi.value}
                        </span>
                        {kpi.change && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            kpi.trend === 'up'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : kpi.trend === 'down'
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                          }`}>
                            {kpi.change}
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl p-5 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Key Business Observations & Insights
                  </h4>
                  <ul className="space-y-2.5">
                    {analysis.key_insights.map((insight, idx) => (
                      <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5 leading-relaxed">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl p-5 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Detected Anomalies & Risk Flags
                  </h4>
                  {analysis.anomalies_and_warnings && analysis.anomalies_and_warnings.length > 0 ? (
                    <ul className="space-y-2.5">
                      {analysis.anomalies_and_warnings.map((anomaly, idx) => (
                        <li key={idx} className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/40 flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{anomaly}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-muted-foreground p-6 text-center italic">
                      No significant statistical anomalies or revenue risks detected in this dataset.
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => setViewTab('studio')}
                      className="text-xs font-semibold gap-1.5"
                    >
                      Open in Chart Studio
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              </div>

              {analysis.recommended_charts && analysis.recommended_charts.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    AI Recommended Visualizations
                  </h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysis.recommended_charts.map((rec, idx) => (
                      <Card
                        key={idx}
                        onClick={() => {
                          setChartTitle(rec.title);
                          setChartType(rec.chart_type || 'bar');
                          setSelectedX(rec.x_key);
                          setSelectedY(rec.y_key);
                          setAggregation((rec.aggregation as any) || 'sum');
                          setViewTab('studio');
                        }}
                        className="p-4 bg-white dark:bg-slate-900 border border-border hover:border-primary/80 transition-all cursor-pointer shadow-xs hover:shadow-md rounded-xl space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {rec.chart_type.toUpperCase()} CHART
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                          {rec.title}
                        </h5>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {rec.description || `Plots ${rec.y_key} grouped by ${rec.x_key}.`}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 2: Studio */}
          {viewTab === 'studio' && (
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl p-5 space-y-5 lg:col-span-1">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Chart Builder Controls
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Customize dimensions, metrics, and visualization format.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Visualization Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChartType('bar')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        chartType === 'bar'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <BarChart3 className="h-4 w-4" />
                      Vertical Bar
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('line')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        chartType === 'line'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <LineChartIcon className="h-4 w-4" />
                      Trend Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('pie')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        chartType === 'pie'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <PieChartIcon className="h-4 w-4" />
                      Donut Share
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType('area')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                        chartType === 'area'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Area Curve
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    X-Axis Dimension (Group By)
                  </label>
                  <select
                    value={selectedX}
                    onChange={(e) => setSelectedX(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {categoricalColumns.includes(h) ? '(Category)' : '(Numeric)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Y-Axis Metric (Value)
                  </label>
                  <select
                    value={selectedY}
                    onChange={(e) => setSelectedY(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">-- Count of Rows --</option>
                    {parsedData.headers.map((h) => (
                      <option key={h} value={h}>
                        {h} {numericColumns.includes(h) ? '(Numeric)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Metric Aggregation
                  </label>
                  <select
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="sum">Sum (Total)</option>
                    <option value="avg">Average (Mean)</option>
                    <option value="count">Count (Frequency)</option>
                    <option value="max">Maximum</option>
                    <option value="min">Minimum</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Chart Display Title
                  </label>
                  <Input
                    value={chartTitle}
                    onChange={(e) => setChartTitle(e.target.value)}
                    className="text-xs h-9"
                    placeholder="Enter custom chart title"
                  />
                </div>
              </Card>

              {/* Chart Display Canvas */}
              <Card className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl p-6 lg:col-span-2 flex flex-col justify-between min-h-[460px]">
                <div className="space-y-1 pb-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {chartTitle || `${selectedY || 'Count'} by ${selectedX}`}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {aggregation.toUpperCase()} of {selectedY || 'records'} grouped by {selectedX}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                    Top {chartData.length} items
                  </span>
                </div>

                <div className="py-6 flex-1 flex items-center justify-center">
                  {chartData.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground italic">
                      No numeric data available to render chart with selected axes.
                    </div>
                  ) : chartType === 'bar' ? (
                    <div className="w-full space-y-3">
                      {chartData.map((item, idx) => {
                        const pct = Math.round((item.value / maxChartValue) * 100);
                        const color = chartColors[idx % chartColors.length];
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="truncate max-w-[240px] text-slate-800 dark:text-slate-200">
                                {item.label}
                              </span>
                              <span className="text-slate-900 dark:text-white font-mono font-bold">
                                {item.value.toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
                                className="h-full rounded-full transition-all duration-500 shadow-sm"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : chartType === 'pie' ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-8 w-full">
                      <div className="relative h-56 w-56 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                          {(() => {
                            const totalSum = chartData.reduce((acc, d) => acc + d.value, 0) || 1;
                            let cumulativeAngle = 0;

                            return chartData.map((d, idx) => {
                              const slicePct = d.value / totalSum;
                              const strokeDash = `${slicePct * 283} 283`;
                              const strokeOffset = -cumulativeAngle * 283;
                              cumulativeAngle += slicePct;

                              return (
                                <circle
                                  key={idx}
                                  cx="50"
                                  cy="50"
                                  r="45"
                                  fill="transparent"
                                  stroke={chartColors[idx % chartColors.length]}
                                  strokeWidth="12"
                                  strokeDasharray={strokeDash}
                                  strokeDashoffset={strokeOffset}
                                  className="transition-all duration-300 hover:opacity-80"
                                />
                              );
                            });
                          })()}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Sum</span>
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                            {chartData.reduce((a, b) => a + b.value, 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-2 flex-1">
                        {chartData.map((d, idx) => {
                          const totalSum = chartData.reduce((acc, item) => acc + item.value, 0) || 1;
                          const pct = Math.round((d.value / totalSum) * 100);
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs font-semibold gap-3">
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className="h-3 w-3 rounded-full shrink-0"
                                  style={{ backgroundColor: chartColors[idx % chartColors.length] }}
                                />
                                <span className="truncate text-slate-700 dark:text-slate-300">{d.label}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-slate-900 dark:text-white">{d.value.toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-64 flex flex-col justify-end gap-2 pt-6">
                      <div className="flex-1 flex items-end justify-between gap-2 border-b border-l border-border pb-2 pl-2">
                        {chartData.map((d, idx) => {
                          const heightPct = Math.max(Math.round((d.value / maxChartValue) * 100), 4);
                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                              <div className="text-[9px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                                {d.value.toLocaleString()}
                              </div>
                              <div
                                style={{ height: `${heightPct}%` }}
                                className={`w-full max-w-[32px] rounded-t-md transition-all duration-300 ${
                                  chartType === 'area'
                                    ? 'bg-gradient-to-t from-primary/30 to-primary border-t-2 border-primary'
                                    : 'bg-primary hover:bg-primary/80'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground font-semibold px-2">
                        {chartData.map((d, idx) => (
                          <span key={idx} className="truncate max-w-[50px] text-center" title={d.label}>
                            {d.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span>Data source: {fileName || 'Uploaded CSV'}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const csvStr = `Label,Value\n` + chartData.map(d => `"${d.label}",${d.value}`).join('\n');
                      const blob = new Blob([csvStr], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `chart_export_${Date.now()}.csv`;
                      a.click();
                    }}
                    className="text-xs font-semibold gap-1.5 h-8"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Chart Data (CSV)
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Sub-Tab 3: Table */}
          {viewTab === 'table' && (
            <Card className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search across all rows & columns..."
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 text-xs h-9"
                  />
                </div>

                <div className="text-xs text-muted-foreground font-medium">
                  Showing {paginatedRows.length} of {filteredRows.length} rows ({parsedData.headers.length} columns)
                </div>
              </div>

              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] font-bold sticky top-0">
                    <tr>
                      <th className="p-3 border-b border-border w-12 text-center text-muted-foreground">#</th>
                      {parsedData.headers.map((h) => (
                        <th key={h} className="p-3 border-b border-border whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 text-center text-[10px] text-muted-foreground font-mono">
                          {(currentPage - 1) * rowsPerPage + rIdx + 1}
                        </td>
                        {parsedData.headers.map((h) => (
                          <td key={h} className="p-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="p-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="h-8 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="h-8 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Sub-Tab 4: Q&A */}
          {viewTab === 'qa' && (
            <div className="space-y-6">
              <Card className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl p-5">
                <form onSubmit={handleAskAI} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      Ask Any Question About Your Spreadsheet
                    </h4>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Powered by Gemini 2.0 Flash
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 'What was the highest grossing product?' or 'Compare CAC between campaigns'..."
                      value={qaQuery}
                      onChange={(e) => setQaQuery(e.target.value)}
                      className="text-xs h-10"
                      disabled={qaLoading}
                    />
                    <Button
                      type="submit"
                      disabled={qaLoading || !qaQuery.trim()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 h-10 shrink-0"
                    >
                      {qaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Ask AI
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground">Quick queries:</span>
                    {[
                      'What are the top 3 revenue drivers?',
                      'Which region or category has lowest performance?',
                      'Summarize monthly growth rate'
                    ].map((prompt, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => {
                          setQaQuery(prompt);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors border border-border"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </form>
              </Card>

              <div className="space-y-4">
                {qaHistory.length === 0 ? (
                  <div className="p-12 text-center text-xs text-muted-foreground italic bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
                    No questions asked yet. Ask a question above to explore your spreadsheet data!
                  </div>
                ) : (
                  qaHistory.map((item, qIdx) => (
                    <Card key={qIdx} className="bg-white dark:bg-slate-900 border border-border shadow-sm rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-[10px]">
                            Q
                          </span>
                          <span>{item.query}</span>
                        </div>
                      </div>

                      <div className="space-y-3 pl-8">
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {item.answer}
                        </p>

                        {item.findings && item.findings.length > 0 && (
                          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-border space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Data Evidence & Key Points:
                            </span>
                            <ul className="space-y-1">
                              {item.findings.map((f, fIdx) => (
                                <li key={fIdx} className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {item.action && (
                          <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40 flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span><strong>Recommended Action:</strong> {item.action}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
