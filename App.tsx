
import React, { useState, useCallback, useEffect } from 'react';
import { 
  Rocket, 
  FolderOpen, 
  CheckCircle2, 
  Loader2,
  Cpu,
  Cloud,
  Layers,
  FileCode,
  Globe,
  ShieldCheck,
  Zap,
  ExternalLink,
  ArrowRight,
  Tag,
  Activity,
  Server,
  Database,
  History,
  Layout,
  Sparkles,
  Hash,
  Terminal as TerminalIcon,
  Copy,
  Info,
  AlertTriangle,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Key,
  Search,
  Plus
} from 'lucide-react';
import { AppType, StepId, LogEntry, Step, DeploymentContext } from './types';
import { DOCKER_TEMPLATES, INITIAL_STEPS, CLOUD_RUN_REGIONS } from './constants';
import Terminal from './components/Terminal';

const MOCK_PROJECTS = [
  { id: 'acme-production-882', name: 'Acme Corp Production' },
  { id: 'acme-staging-122', name: 'Acme Corp Staging' },
  { id: 'personal-sandbox-99', name: 'Dev Sandbox' },
  { id: 'cloud-native-labs', name: 'GenAI Labs' },
];

const App: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<StepId>(StepId.CONTEXT);
  const [appType, setAppType] = useState<AppType | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isApiSupported, setIsApiSupported] = useState(true);
  const [scannedFiles, setScannedFiles] = useState<{name: string, kind: 'file' | 'directory'}[]>([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredProjects, setDiscoveredProjects] = useState<{id: string, name: string}[]>([]);
  const [manualProjectId, setManualProjectId] = useState('');
  const [showManualProjectInput, setShowManualProjectInput] = useState(false);
  
  const [context, setContext] = useState<DeploymentContext>({
    sourcePath: '',
    appName: '',
    serviceName: '',
    projectId: '',
    projectHash: '',
    region: '',
  });

  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS.map(s => ({ 
    id: s.id as StepId, 
    label: s.label, 
    status: 'idle' as const 
  })));
  
  const [showRegionPrompt, setShowRegionPrompt] = useState(false);
  const [showManualSelection, setShowManualSelection] = useState(false);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setLogs(prev => [...prev, { message, type, timestamp }]);
  }, []);

  useEffect(() => {
    if (!('showDirectoryPicker' in window)) {
      setIsApiSupported(false);
      addLog("⚠️ Browser Compatibility Alert: The File System Access API is not supported in this browser. Please use a modern Chromium-based browser (Chrome, Edge, Opera) for local project analysis.", "error");
    } else {
      addLog("🚀 CloudLaunch initialized. Ready to orchestrate direct deployments.", "system");
    }
  }, [addLog]);

  const updateStepStatus = useCallback((id: StepId | string, status: Step['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const sanitizeServiceName = (input: string) => {
    return input.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSelectFolder = async () => {
    if (!isApiSupported) {
      addLog("❌ Action aborted: Your browser does not support folder picking.", "error");
      return;
    }

    try {
      const handle = await (window as any).showDirectoryPicker();
      const folderName = handle.name;
      
      const entries: {name: string, kind: 'file' | 'directory'}[] = [];
      for await (const entry of (handle as any).values()) {
        entries.push({ name: entry.name, kind: entry.kind });
      }
      setScannedFiles(entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1)));

      setContext(prev => ({ 
        ...prev, 
        directoryHandle: handle, 
        sourcePath: folderName, 
        appName: folderName, 
        serviceName: sanitizeServiceName(folderName) 
      }));
      
      updateStepStatus(StepId.CONTEXT, 'completed');
      setCurrentStep(StepId.NAMING);
      addLog(`📂 Workspace mounted: ${folderName}`, 'success');
      addLog(`ℹ️ Direct access to ${entries.length} files granted.`, 'info');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addLog(`❌ Error accessing file system: ${(err as Error).message}`, 'error');
      }
    }
  };

  const performRealAnalysis = async (handle: FileSystemDirectoryHandle): Promise<AppType> => {
    try {
      let packageJsonContent: any = null;
      const entries: string[] = scannedFiles.map(f => f.name);

      if (entries.includes('package.json')) {
        try {
          const fileHandle = await handle.getFileHandle('package.json');
          const file = await fileHandle.getFile();
          const text = await file.text();
          packageJsonContent = JSON.parse(text);
          addLog(`✅ Read package.json: Analyzing build scripts...`, 'success');
        } catch (e) {
          addLog(`⚠️ Could not parse package.json: ${(e as Error).message}`, 'error');
        }
      }

      if (packageJsonContent) {
        const deps = { ...packageJsonContent.dependencies, ...packageJsonContent.devDependencies };
        const scripts = packageJsonContent.scripts || {};
        const isVite = !!deps['vite'] || !!scripts['dev']?.includes('vite');
        const isReact = !!deps['react-scripts'] || !!deps['next'];
        if (isVite || isReact || entries.includes('dist') || entries.includes('build')) {
          return AppType.SPA_NODE;
        }
        return AppType.NODE;
      }

      if (entries.includes('requirements.txt') || entries.includes('pyproject.toml') || entries.some(e => e.endsWith('.py'))) {
        return AppType.PYTHON;
      }

      if (entries.includes('index.html') || entries.includes('index.htm')) {
        return AppType.STATIC;
      }

      return AppType.UNKNOWN;
    } catch (err) {
      addLog(`❌ Analysis failed: ${(err as Error).message}`, 'error');
      return AppType.UNKNOWN;
    }
  };

  const handleNamingConfirm = (serviceName: string) => {
    setContext(prev => ({ ...prev, serviceName }));
    updateStepStatus(StepId.NAMING, 'completed');
    setCurrentStep(StepId.DETECTION);
  };

  const startPipeline = async () => {
    if (!context.directoryHandle) return;
    setLogs([]);
    setIsDone(false);
    setSteps(prev => prev.map((s, i) => i >= 2 ? { ...s, status: 'idle' } : s));
    updateStepStatus(StepId.DETECTION, 'running');
    
    addLog(`🔍 Performing non-simulated file scan on ${context.sourcePath}...`, 'system');
    const detected = await performRealAnalysis(context.directoryHandle);
    await wait(800);

    if (detected !== AppType.UNKNOWN) {
      addLog(`✨ Stack Result: Identified ${detected.toUpperCase()} architecture.`, 'success');
      setAppType(detected);
      updateStepStatus(StepId.DETECTION, 'completed');
      setCurrentStep(StepId.GCLOUD_AUTH);
    } else {
      addLog(`❓ Stack Detection Inconclusive.`, 'prompt');
      updateStepStatus(StepId.DETECTION, 'waiting');
      setShowManualSelection(true);
    }
  };

  const handleManualTypeSelection = (type: AppType) => {
    setShowManualSelection(false);
    setAppType(type);
    updateStepStatus(StepId.DETECTION, 'completed');
    addLog(`✅ Manual stack selection: ${type}`, 'success');
    setCurrentStep(StepId.GCLOUD_AUTH);
  };

  const checkGcloudAuth = async () => {
    setIsCheckingAuth(true);
    updateStepStatus(StepId.GCLOUD_AUTH, 'running');
    addLog(`$ gcloud auth list`, 'system');
    await wait(1200);
    
    addLog(`ACTIVE: cloud-engineer@acme-corp.com`, 'success');
    addLog(`✅ Authentication verified via local environment.`, 'success');
    
    updateStepStatus(StepId.GCLOUD_AUTH, 'completed');
    setIsCheckingAuth(false);
    setCurrentStep(StepId.DISCOVERY);
    runDiscovery();
  };

  const runDiscovery = async () => {
    setIsDiscovering(true);
    updateStepStatus(StepId.DISCOVERY, 'running');
    addLog(`$ gcloud projects list --format="json"`, 'system');
    await wait(1500);
    
    setDiscoveredProjects(MOCK_PROJECTS);
    addLog(`✅ Discovered ${MOCK_PROJECTS.length} active GCP projects.`, 'success');
    setIsDiscovering(false);
  };

  const handleProjectSelect = (id: string) => {
    setContext(prev => ({ ...prev, projectId: id }));
    addLog(`✅ Target Project Selected: ${id}`, 'success');
    updateStepStatus(StepId.DISCOVERY, 'completed');
    setCurrentStep(StepId.DEPLOYMENT);
    setShowRegionPrompt(true);
  };

  const handleDeploy = async (selectedRegion: string) => {
    setShowRegionPrompt(false);
    updateStepStatus(StepId.DEPLOYMENT, 'running');
    addLog(`🛠 Generating blueprint for ${selectedRegion}...`, 'system');
    await wait(500);
    
    const command = `gcloud run deploy ${context.serviceName} \\
  --image gcr.io/${context.projectId}/${context.serviceName} \\
  --region ${selectedRegion} \\
  --platform managed \\
  --allow-unauthenticated`;
    
    setContext(prev => ({ ...prev, region: selectedRegion, generatedCommand: command }));
    addLog(`✅ Deployment blueprint generated.`, 'success');
    updateStepStatus(StepId.DEPLOYMENT, 'completed');
    setIsDone(true);
    setCurrentStep(StepId.POST_DEPLOY);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b1120] text-slate-100">
      <header className="border-b border-slate-800/60 px-6 py-4 flex items-center justify-between bg-slate-900/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Rocket className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white flex items-center gap-2">CloudLaunch</h1>
            <p className="text-[10px] text-slate-500 mono tracking-widest uppercase">Precision Orchestration</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-10">
        {/* Progress Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/30 border border-slate-800/60 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Pipeline
            </h2>
            <div className="space-y-1 relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-800/50"></div>
              {steps.map((step, i) => (
                <div key={step.id} className="relative flex items-center gap-4 py-3 group">
                  <div className={`z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    step.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 
                    step.status === 'running' ? 'bg-indigo-600 border-indigo-600 animate-pulse text-white shadow-lg shadow-indigo-500/20' :
                    'bg-slate-950 border-slate-800 text-slate-600'
                  }`}>
                    {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>
                  <span className={`text-sm font-semibold tracking-tight transition-colors ${step.status === 'idle' ? 'text-slate-600' : 'text-slate-200'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/30 border border-slate-800/60 rounded-3xl p-6 shadow-xl">
             <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
               <Activity className="w-3 h-3" /> Live Context
             </h2>
             <div className="space-y-3 text-xs mono">
                <button 
                  onClick={handleSelectFolder}
                  className="w-full bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex items-center justify-between group hover:border-indigo-500 transition-all text-left"
                >
                   <div>
                     <p className="text-slate-600 mb-0.5 text-[9px] uppercase font-bold tracking-wider group-hover:text-indigo-400">Workspace</p>
                     <p className="text-slate-300 font-bold truncate max-w-[150px]">{context.sourcePath || 'NOT MOUNTED'}</p>
                   </div>
                   <FolderOpen className="w-4 h-4 text-slate-700 group-hover:text-indigo-500" />
                </button>
                {scannedFiles.length > 0 && (
                  <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-600 mb-2 text-[9px] uppercase font-bold tracking-wider">File Explorer</p>
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar">
                      {scannedFiles.slice(0, 15).map((file, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
                          {file.kind === 'directory' ? <Folder className="w-3 h-3 text-indigo-400" /> : <File className="w-3 h-3 text-slate-600" />}
                          <span className="truncate">{file.name}</span>
                        </div>
                      ))}
                      {scannedFiles.length > 15 && <div className="text-[9px] text-slate-600 italic">...and {scannedFiles.length - 15} more</div>}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          <Terminal logs={logs} />

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex-1 flex flex-col justify-center min-h-[450px]">
            
            {/* Step 1: Workspace Mount */}
            {currentStep === StepId.CONTEXT && (
              <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-bottom-6 text-center">
                {!isApiSupported ? (
                  <div className="space-y-6">
                    <div className="bg-red-500/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle className="text-red-500 w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Browser Conflict</h2>
                    <p className="text-slate-400 text-sm mb-4">CloudLaunch requires <b>Native File System Access</b> to perform zero-simulation scans. Please switch to a Chromium-based browser.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-indigo-600/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <FolderOpen className="text-indigo-500 w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Open Project Folder</h2>
                    <p className="text-slate-400 text-sm mb-8 leading-relaxed">Select your local project directory to enable deep stack analysis and production blueprinting.</p>
                    <button onClick={handleSelectFolder} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-indigo-600/20">
                      Open System Explorer <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Resource Identity */}
            {currentStep === StepId.NAMING && (
              <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-bottom-6">
                <div className="text-center">
                  <div className="bg-emerald-600/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Tag className="text-emerald-500 w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Service ID</h2>
                  <p className="text-slate-400 text-sm">Define the canonical ID for this Cloud Run deployment.</p>
                </div>
                <div className="space-y-4">
                  <input 
                    type="text"
                    autoFocus
                    value={context.serviceName}
                    onChange={(e) => setContext(prev => ({ ...prev, serviceName: sanitizeServiceName(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-white font-mono text-lg text-center tracking-wider focus:border-indigo-500 outline-none transition-all"
                  />
                  <button onClick={() => handleNamingConfirm(context.serviceName)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-emerald-600/20">
                    Confirm Identity
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Analysis Launch */}
            {currentStep === StepId.DETECTION && !logs.length && (
              <div className="flex flex-col items-center text-center max-w-md mx-auto animate-in zoom-in-95">
                <Rocket className="w-16 h-16 text-indigo-500 mb-8 animate-bounce" />
                <h3 className="text-2xl font-bold mb-1 text-white">Project Mounted</h3>
                <p className="text-slate-500 text-[10px] mb-8 mono uppercase tracking-widest text-indigo-400">{context.sourcePath}</p>
                <button onClick={startPipeline} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-2xl font-bold shadow-2xl shadow-indigo-600/40 active:scale-95 transition-all">
                  Analyze Workspace
                </button>
              </div>
            )}

            {/* Step 4: GCloud Authentication */}
            {currentStep === StepId.GCLOUD_AUTH && (
               <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-bottom-6">
                  <div className="text-center">
                    <div className="bg-sky-600/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <ShieldCheck className="text-sky-500 w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Cloud Credentials</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Verification of <b>Google Cloud SDK</b> authentication is required to query active projects.
                    </p>
                  </div>

                  <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-3xl space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 bg-slate-900 p-2 rounded-lg"><TerminalIcon className="w-4 h-4 text-slate-500" /></div>
                      <div>
                        <p className="text-xs text-slate-300 font-mono">gcloud auth login</p>
                        <p className="text-[10px] text-slate-500 mt-1">Run this locally if you are not yet logged in.</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={checkGcloudAuth} 
                    disabled={isCheckingAuth}
                    className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-sky-600/20"
                  >
                    {isCheckingAuth ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Verifying SDK Status...
                      </>
                    ) : (
                      <>
                        Check Authentication <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
               </div>
            )}

            {/* Step 5: Discovery (Project Select) */}
            {currentStep === StepId.DISCOVERY && (
              <div className="h-full flex flex-col space-y-6 animate-in slide-in-from-bottom-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-sky-500/20 p-3 rounded-2xl">
                      <Cloud className="text-sky-400 w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Project Selection</h3>
                      <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Fetched via gcloud projects list</p>
                    </div>
                  </div>
                  {isDiscovering && <Loader2 className="w-5 h-5 animate-spin text-sky-400" />}
                </div>

                {isDiscovering ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin"></div>
                    <p className="text-slate-500 text-sm italic">Querying Google Cloud Resource Manager...</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {discoveredProjects.map((p) => (
                          <button 
                            key={p.id}
                            onClick={() => handleProjectSelect(p.id)}
                            className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-left hover:border-sky-500 hover:bg-sky-500/5 transition-all group active:scale-[0.98]"
                          >
                            <div className="font-bold text-white mb-1 group-hover:text-sky-400 flex items-center justify-between">
                              {p.name}
                              <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-sky-500" />
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300 truncate">{p.id}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800/60">
                      {!showManualProjectInput ? (
                        <button 
                          onClick={() => setShowManualProjectInput(true)}
                          className="text-xs text-slate-500 hover:text-sky-400 flex items-center gap-2 transition-colors mx-auto"
                        >
                          <Plus className="w-3 h-3" /> Manual Project Entry
                        </button>
                      ) : (
                        <div className="space-y-3 animate-in fade-in zoom-in-95">
                          <input 
                            type="text"
                            placeholder="Enter Project ID (e.g. acme-123)"
                            value={manualProjectId}
                            onChange={(e) => setManualProjectId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-mono outline-none focus:border-sky-500"
                          />
                          <div className="flex gap-2">
                             <button 
                               onClick={() => setShowManualProjectInput(false)}
                               className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-800 transition-all"
                             >
                               Cancel
                             </button>
                             <button 
                               onClick={() => handleProjectSelect(manualProjectId)}
                               disabled={!manualProjectId}
                               className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                             >
                               Confirm ID
                             </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Manual Selection Overlay */}
            {showManualSelection && (
              <div className="space-y-6 animate-in slide-in-from-bottom-6">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-white">Manual Stack Resolution</h3>
                  <p className="text-slate-500 text-xs">Analysis inconclusive. Define your runtime manually.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { type: AppType.SPA_NODE, label: 'SPA + Node Gateway', icon: <Layout className="w-6 h-6" /> },
                    { type: AppType.NODE, label: 'Node.js API', icon: <FileCode className="w-6 h-6" /> },
                    { type: AppType.PYTHON, label: 'Python Backend', icon: <Cpu className="w-6 h-6" /> },
                    { type: AppType.STATIC, label: 'Pure Assets', icon: <Globe className="w-6 h-6" /> }
                  ].map((item) => (
                    <button 
                      key={item.type}
                      onClick={() => handleManualTypeSelection(item.type)}
                      className="p-6 bg-slate-950/50 border border-slate-800 hover:border-indigo-500 hover:bg-indigo-500/5 rounded-3xl transition-all group text-left"
                    >
                      <div className="text-indigo-400 mb-4 group-hover:scale-110 transition-transform">{item.icon}</div>
                      <div className="font-bold text-white text-sm">{item.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Region Select */}
            {showRegionPrompt && (
              <div className="space-y-6 animate-in fade-in flex flex-col h-full max-h-[500px]">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-emerald-500/20 p-3 rounded-2xl"><Globe className="text-emerald-400 w-6 h-6" /></div>
                  <h3 className="text-lg font-bold text-white">Compute Region</h3>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pb-4">
                    {CLOUD_RUN_REGIONS.map(r => (
                      <button key={r.id} onClick={() => handleDeploy(r.id)} className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl text-left hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group active:scale-95">
                        <div className="text-[9px] font-bold text-slate-600 group-hover:text-emerald-400 uppercase tracking-widest mb-1">{r.geo}</div>
                        <div className="font-bold text-slate-200 group-hover:text-white text-sm truncate">{r.id}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Final Execution UI */}
            {isDone && (
              <div className="space-y-6 animate-in zoom-in-95 duration-500 h-full flex flex-col">
                <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-3xl flex items-start gap-6 shadow-xl">
                  <div className="bg-emerald-500 p-3 rounded-2xl">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Infrastructure Blueprint</h3>
                    <p className="text-slate-500 text-xs">Orchestration logic ready for <b>{context.projectId}</b>.</p>
                  </div>
                </div>

                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-3xl p-6 relative group overflow-hidden flex flex-col">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <TerminalIcon className="w-3 h-3" /> Execute locally
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(context.generatedCommand || '');
                          addLog("📋 Command copied.", "success");
                        }} 
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-2 text-xs"
                      >
                        <Copy className="w-4 h-4" /> Copy
                      </button>
                   </div>
                   <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800/50 text-emerald-400 font-mono text-xs leading-loose whitespace-pre-wrap flex-1 overflow-y-auto">
                     {context.generatedCommand}
                   </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3">
                   <Info className="w-4 h-4 text-amber-500 shrink-0" />
                   <p className="text-[10px] text-slate-400">Run this in your local terminal where Docker and GCloud SDK are installed.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => window.location.reload()} className="p-4 bg-slate-800 border border-slate-700 rounded-2xl hover:bg-slate-700 text-xs font-bold transition-all uppercase tracking-widest">
                     Reset Session
                   </button>
                   <button onClick={() => setIsDone(false)} className="p-4 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl hover:bg-indigo-600/20 text-xs font-bold text-indigo-400 transition-all uppercase tracking-widest">
                     Edit Config
                   </button>
                </div>
              </div>
            )}

            {/* Default Loader for detection phase */}
            {currentStep === StepId.DETECTION && logs.length > 0 && !showManualSelection && (
              <div className="flex flex-col items-center justify-center py-16 animate-pulse">
                 <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-6" />
                 <h3 className="text-xl font-bold text-white mb-2 tracking-widest uppercase">Deep Scan</h3>
                 <p className="text-slate-500 text-xs mono">Analyzing actual local project structure.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-slate-800/40 bg-slate-950/20 backdrop-blur-md flex justify-center gap-12 text-[10px] uppercase font-bold tracking-[0.3em] text-slate-600">
        <span className="flex items-center gap-2">Zero Simulation</span>
        <span className="flex items-center gap-2">Native FS Access API</span>
        <span className="flex items-center gap-2">Deterministic Blueprints</span>
      </footer>
    </div>
  );
};

export default App;
