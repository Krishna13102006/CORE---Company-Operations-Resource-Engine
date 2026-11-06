import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractErrorMessage } from '../../lib/api';
import { Button } from '@/components/ui/button';
import {
  Code2,
  Play,
  RotateCcw,
  Copy,
  Check,
  Terminal,
  BookOpen,
  Sparkles,
  Maximize2,
  X,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';

const LANGUAGES = [
  { id: 'python', label: 'Python 3', badge: 'PY', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { id: 'javascript', label: 'JavaScript', badge: 'JS', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { id: 'typescript', label: 'TypeScript', badge: 'TS', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'sql', label: 'SQL', badge: 'SQL', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'java', label: 'Java 17', badge: 'JAVA', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { id: 'cpp', label: 'C++ 20', badge: 'C++', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
];

interface CodeSandboxProps {
  roomCode: string;
  initialData?: any;
  isHost?: boolean;
  userName?: string;
  onClose?: () => void;
}

const STARTER_PROBLEMS: Record<string, { title: string; language: string; code: string }> = {
  two_sum: {
    title: '1. Two Sum (Hash Map Algorithm)',
    language: 'python',
    code: `def two_sum(nums, target):
    """
    Given an array of integers nums and an integer target,
    return indices of the two numbers such that they add up to target.
    Time Complexity: O(n) | Space Complexity: O(n)
    """
    lookup = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in lookup:
            return [lookup[complement], i]
        lookup[num] = i
    return []

# Test Cases
print("Test 1 [2, 7, 11, 15] target=9 ->", two_sum([2, 7, 11, 15], 9))
print("Test 2 [3, 2, 4] target=6        ->", two_sum([3, 2, 4], 6))
print("Test 3 [3, 3] target=6           ->", two_sum([3, 3], 6))
`
  },
  lru_cache: {
    title: '2. LRU Cache Implementation',
    language: 'python',
    code: `class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        # Move to most recently used
        val = self.cache.pop(key)
        self.cache[key] = val
        return val

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.pop(key)
        elif len(self.cache) >= self.capacity:
            # Evict oldest item
            oldest = next(iter(self.cache))
            del self.cache[oldest]
        self.cache[key] = value

# Test execution
cache = LRUCache(2)
cache.put(1, 100)
cache.put(2, 200)
print("Get 1:", cache.get(1))  # Returns 100
cache.put(3, 300)             # Evicts key 2
print("Get 2:", cache.get(2))  # Returns -1 (evicted)
print("Get 3:", cache.get(3))  # Returns 300
`
  },
  sql_query: {
    title: '3. SQL Department High Earner Query',
    language: 'sql',
    code: `-- Find employees who earn more than the average salary of their department
SELECT 
    e.id,
    e.first_name,
    e.salary,
    d.name AS department_name,
    ROUND(avg_dept.avg_sal, 2) AS dept_average_salary
FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN (
    SELECT department_id, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY department_id
) avg_dept ON e.department_id = avg_dept.department_id
WHERE e.salary > avg_dept.avg_sal
ORDER BY e.salary DESC;
`
  },
  js_async: {
    title: '4. JavaScript Async Pipeline & Concurrency Limiter',
    language: 'javascript',
    code: `// Concurrency-limited async task pool
async function mapConcurrent(items, limit, asyncFn) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => asyncFn(item));
    results.push(p);

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

// Demo
const tasks = [1, 2, 3, 4, 5];
console.log("Processing 5 tasks with concurrency=2...");
mapConcurrent(tasks, 2, async (t) => {
  return "Completed task #" + t;
}).then(res => console.log("Results:", res));
`
  }
};

export const MeetingCodeSandbox: React.FC<CodeSandboxProps> = ({
  roomCode,
  initialData,
  isHost,
  userName = 'Interviewer',
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [language, setLanguage] = useState<string>('python');
  const [code, setCode] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false);
  const [isProbMenuOpen, setIsProbMenuOpen] = useState<boolean>(false);
  const langDropdownRef = useRef<HTMLDivElement | null>(null);
  const probDropdownRef = useRef<HTMLDivElement | null>(null);
  const syncTimerRef = useRef<any>(null);
  const isTypingRef = useRef<boolean>(false);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
      if (probDropdownRef.current && !probDropdownRef.current.contains(e.target as Node)) {
        setIsProbMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll code sandbox state
  const { data: sandboxData } = useQuery({
    queryKey: ['meeting-code-sandbox', roomCode],
    queryFn: () => api.get(`/meetings/room/${roomCode}/code/`),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (sandboxData && !isTypingRef.current) {
      if (sandboxData.code !== undefined && sandboxData.code !== code) {
        setCode(sandboxData.code);
      }
      if (sandboxData.language) {
        setLanguage(sandboxData.language);
      }
      if (sandboxData.output !== undefined) {
        setOutput(sandboxData.output);
      }
      if (sandboxData.updated_by) {
        setLastUpdatedBy(sandboxData.updated_by);
      }
    }
  }, [sandboxData]);

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: (payload: { code: string; language: string; output?: string }) =>
      api.post(`/meetings/room/${roomCode}/code/`, payload),
  });

  // Run code mutation
  const runMutation = useMutation({
    mutationFn: (payload: { code: string; language: string }) =>
      api.post(`/meetings/room/${roomCode}/code/run/`, payload),
    onSuccess: (res: any) => {
      setOutput(res.output || 'Execution complete.');
      queryClient.invalidateQueries({ queryKey: ['meeting-code-sandbox', roomCode] });
    },
    onError: (err: any) => {
      setOutput(`[Execution Error]:\n${extractErrorMessage(err)}`);
    },
  });

  const triggerDebouncedSync = (newCode: string, newLang: string) => {
    isTypingRef.current = true;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      syncMutation.mutate({ code: newCode, language: newLang });
    }, 1200);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCode(val);
    triggerDebouncedSync(val, language);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = code.substring(0, start) + '    ' + code.substring(end);
      setCode(updated);
      triggerDebouncedSync(updated, language);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleSelectProblem = (key: string) => {
    const prob = STARTER_PROBLEMS[key];
    if (prob) {
      setLanguage(prob.language);
      setCode(prob.code);
      setOutput('');
      syncMutation.mutate({ code: prob.code, language: prob.language, output: '' });
    }
  };

  const handleRun = () => {
    runMutation.mutate({ code, language });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compute line numbers
  const lineCount = Math.max(code.split('\n').length, 18);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-950 text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Top Header Bar */}
      <div className="h-13 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Code2 className="h-4 w-4" />
            </div>
            <span className="font-bold text-xs text-white">Live Collaborative Code Sandbox</span>
          </div>

          {/* Modern Sleek Language Selector */}
          <div className="relative" ref={langDropdownRef}>
            {(() => {
              const currentLang = LANGUAGES.find((l) => l.id === language) || LANGUAGES[0];
              return (
                <button
                  type="button"
                  onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                  className="h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-700 hover:border-indigo-500/50 flex items-center gap-2 text-xs font-semibold text-slate-200 transition-colors shadow-inner"
                >
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-bold ${currentLang.color}`}>
                    {currentLang.badge}
                  </span>
                  <span>{currentLang.label}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
              );
            })()}

            {isLangMenuOpen && (
              <div className="absolute top-10 left-0 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLanguage(l.id);
                      triggerDebouncedSync(code, l.id);
                      setIsLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                      language === l.id
                        ? 'bg-indigo-600/20 text-white font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-bold ${l.color}`}>
                        {l.badge}
                      </span>
                      <span>{l.label}</span>
                    </div>
                    {language === l.id && <Check className="h-3 w-3 text-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sleek Starter Problem Bank Dropdown */}
          <div className="relative" ref={probDropdownRef}>
            <button
              type="button"
              onClick={() => setIsProbMenuOpen(!isProbMenuOpen)}
              className="h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-700/80 hover:border-indigo-500/50 flex items-center gap-1.5 text-xs font-medium text-indigo-300 transition-colors shadow-inner"
            >
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Templates</span>
              <ChevronDown className="h-3 w-3 text-indigo-400" />
            </button>

            {isProbMenuOpen && (
              <div className="absolute top-10 left-0 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800/80 mb-1">
                  Technical Interview Starter Bank
                </div>
                {Object.entries(STARTER_PROBLEMS).map(([k, p]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      handleSelectProblem(k);
                      setIsProbMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-between transition-colors"
                  >
                    <span className="truncate">{p.title}</span>
                    <span className="text-[10px] uppercase font-mono text-slate-500 shrink-0 ml-2">{p.language}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {lastUpdatedBy && (
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Synced • <strong className="text-slate-300">{lastUpdatedBy}</strong>
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-8 px-2.5 text-xs border-slate-700 bg-slate-950 text-slate-300 hover:text-white gap-1"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleRun}
            disabled={runMutation.isPending}
            className="h-8 px-3.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-md shadow-emerald-900/30"
          >
            <Play className={`h-3.5 w-3.5 ${runMutation.isPending ? 'animate-spin' : 'fill-white'}`} />
            <span>{runMutation.isPending ? 'Executing...' : 'Run Code'}</span>
          </Button>

          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Split Body: Editor on Left, Terminal on Right */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Monaco-style Code Editor Pane */}
        <div className="flex-1 min-h-0 flex bg-slate-950 font-mono text-xs border-r border-slate-800 relative">
          {/* Line Numbers Gutter */}
          <div className="w-12 py-3 bg-slate-900/70 text-slate-600 select-none text-right pr-3 font-mono border-r border-slate-800/80 shrink-0">
            {lineNumbers.map((num) => (
              <div key={num} className="leading-6">{num}</div>
            ))}
          </div>

          {/* Interactive Code Textarea */}
          <textarea
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            placeholder="// Write code here with candidate..."
            spellCheck={false}
            className="flex-1 p-3 bg-transparent text-emerald-300 focus:outline-none resize-none leading-6 font-mono selection:bg-indigo-600 selection:text-white"
          />
        </div>

        {/* Live Output & Execution Console Pane */}
        <div className="w-full md:w-80 lg:w-96 bg-slate-900/95 flex flex-col shrink-0 border-t md:border-t-0 border-slate-800">
          <div className="h-9 px-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300 shrink-0">
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              TERMINAL OUTPUT
            </span>
            {output && (
              <button
                type="button"
                onClick={() => setOutput('')}
                className="text-[10px] text-slate-500 hover:text-slate-300 underline font-mono"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 p-3 overflow-auto font-mono text-xs space-y-1 bg-slate-950/50">
            {output ? (
              <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">{output}</pre>
            ) : (
              <div className="text-slate-600 text-center py-12 font-mono text-xs space-y-2">
                <Terminal className="h-8 w-8 mx-auto opacity-30 text-slate-500" />
                <p>Click "Run Code" to execute script in sandbox container.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
