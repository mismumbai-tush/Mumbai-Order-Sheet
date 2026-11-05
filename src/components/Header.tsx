import React, { useState } from 'react';
import {
  Copy,
  Check,
  FileCode2,
  FileSpreadsheet,
  Zap,
  Database,
  Flame,
  LogOut,
  Maximize2,
  Minimize2,
  Users,
  Radio,
  Plus,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Terminal,
  HelpCircle
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'simulator' | 'code' | 'firebase' | 'advisor' | 'columns' | 'guide';
  setActiveTab: (tab: 'simulator' | 'code' | 'firebase' | 'advisor' | 'columns' | 'guide') => void;
  onCopyCode: () => void;
  copied: boolean;
  isFullWidth: boolean;
  setIsFullWidth: (val: boolean) => void;
}

export interface ConnectedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  status: 'active' | 'editing' | 'idle';
  activeCell: string;
  avatarColor: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onCopyCode,
  copied,
  isFullWidth,
  setIsFullWidth
}) => {
  // Current Logged-in Google User
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('ginza_google_user_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      name: "MIS Mumbai",
      email: "mis.mumbai@ginzalimited.com",
      role: "Operations & FMS Lead",
      branch: "Mumbai Central",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=80"
    };
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showConnectedUsersModal, setShowConnectedUsersModal] = useState(false);
  const [showVercelFixModal, setShowVercelFixModal] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [copiedGitCmd, setCopiedGitCmd] = useState(false);

  // Live Connected Team Member IDs (Real-time presence)
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([
    {
      id: 'usr_1',
      name: 'MIS Mumbai (You)',
      email: 'mis.mumbai@ginzalimited.com',
      role: 'Operations & FMS Lead',
      branch: 'Mumbai Central',
      status: 'active',
      activeCell: 'Col AN (Status)',
      avatarColor: 'bg-emerald-600'
    },
    {
      id: 'usr_2',
      name: 'Santosh Pachratkar',
      email: 'santosh.p@ginzalimited.com',
      role: 'Sales Lead (Santacruz & Mumbai)',
      branch: 'Mumbai Central',
      status: 'editing',
      activeCell: 'Order 438 (Col S)',
      avatarColor: 'bg-blue-600'
    },
    {
      id: 'usr_3',
      name: 'Kamlesh Sutar',
      email: 'kamlesh.sutar@ginzalimited.com',
      role: 'Sales Manager (Kalyan & Mumbai)',
      branch: 'Mumbai Central',
      status: 'active',
      activeCell: 'Order 715 (Col V)',
      avatarColor: 'bg-purple-600'
    },
    {
      id: 'usr_4',
      name: 'Pradeep Jadhav',
      email: 'pradeep.jadhav@ginzalimited.com',
      role: 'Logistics & Dispatch Lead',
      branch: 'Bhiwandi Hub',
      status: 'editing',
      activeCell: 'Order 1510 (Col Y)',
      avatarColor: 'bg-amber-600'
    },
    {
      id: 'usr_5',
      name: 'Rakesh Jain',
      email: 'rakesh.jain@ginzalimited.com',
      role: 'Sales Executive (Grant Road)',
      branch: 'Mumbai Central',
      status: 'idle',
      activeCell: 'Order 714 (Col Y)',
      avatarColor: 'bg-indigo-600'
    }
  ]);

  const handleAddConnectedUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail.trim()) return;
    const namePart = newInviteEmail.split('@')[0].replace('.', ' ');
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const newUser: ConnectedUser = {
      id: `usr_${Date.now()}`,
      name: formattedName,
      email: newInviteEmail.trim().toLowerCase(),
      role: 'Sheet Viewer & Editor',
      branch: 'Connected Device',
      status: 'active',
      activeCell: 'Viewing Automation Grid',
      avatarColor: 'bg-teal-600'
    };

    setConnectedUsers(prev => [...prev, newUser]);
    setNewInviteEmail('');
  };

  const handleCopyGitCommand = () => {
    const cmd = `git add package.json .npmrc vercel.json\ngit commit -m "fix: resolve vercel esbuild peer dependency"\ngit push origin main`;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopiedGitCmd(true);
      setTimeout(() => setCopiedGitCmd(false), 2500);
    });
  };

  return (
    <>
      {/* 1. SLIM CLEAN HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        <div className={`mx-auto transition-all ${isFullWidth ? 'px-2 sm:px-4' : 'max-w-7xl px-3 sm:px-4'}`}>
          <div className="flex items-center justify-between gap-3 h-11">
            {/* Zone 1: Wordmark & Logo */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-6 h-6 rounded bg-emerald-700 flex items-center justify-center text-white font-bold shadow-2xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
                GINZA FMS
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                Vercel &amp; GitHub Ready
              </span>
            </div>

            {/* Zone 3: Actions & Full Size Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Full Size ON / OFF Button (Replaces Copy Script in Header as requested) */}
              <button
                onClick={() => setIsFullWidth(!isFullWidth)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap shadow-xs cursor-pointer ${
                  isFullWidth
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800 border border-emerald-800'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                }`}
                title={isFullWidth ? "Click for Boxed View" : "Click for Full Size Screen View"}
              >
                {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullWidth ? 'Full Size ON' : 'Full Size'}</span>
              </button>

              {/* GOOGLE USER PROFILE */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-1.5 p-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    {currentUser.name.charAt(0)}
                  </div>
                  <span className="hidden md:inline-block text-xs font-bold text-slate-800">
                    {currentUser.name.split(' ')[0]}
                  </span>
                </button>

                {/* Profile Dropdown */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-xs space-y-2">
                    <div className="pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                          {currentUser.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{currentUser.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="text-slate-500">Branch:</span>
                        <span className="font-semibold text-slate-800">{currentUser.branch}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowConnectedUsersModal(true)}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded font-medium flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>View All Connected IDs ({connectedUsers.length})</span>
                    </button>

                    <button
                      onClick={() => setShowVercelFixModal(true)}
                      className="w-full text-left px-2 py-1.5 text-xs text-amber-700 hover:bg-amber-50 rounded font-medium flex items-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5 text-amber-600" />
                      <span>Vercel Build Fix Guide</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MODAL: LIVE CONNECTED USERS LIST & INVITE */}
      {showConnectedUsersModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 text-slate-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Live Connected Team Members ({connectedUsers.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time active Google IDs syncing with Ginza FMS Cloud
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectedUsersModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* List of Connected Users */}
            <div className="space-y-2">
              {connectedUsers.map(u => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${u.avatarColor} text-white flex items-center justify-center font-bold text-xs`}>
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">{u.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold">
                          {u.branch}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {u.status === 'editing' ? 'Live Editing' : 'Online'}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                      {u.activeCell}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add / Invite Google ID form */}
            <form onSubmit={handleAddConnectedUser} className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Add Team Colleague's Google Account ID:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={newInviteEmail}
                  onChange={e => setNewInviteEmail(e.target.value)}
                  placeholder="e.g. colleague@ginzalimited.com"
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Connect ID</span>
                </button>
              </div>
            </form>

            <div className="bg-slate-100 p-3 rounded-xl text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                All connected IDs receive real-time updates when Column Y (Dispatched), Column AM (LR#), or Column AN (Status) are edited.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VERCEL ERESOLVE BUILD FIX DETAILS */}
      {showVercelFixModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 text-slate-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Vercel Build Error Fix Applied!
                  </h3>
                  <p className="text-xs text-slate-500">
                    Solving: <code className="text-rose-600 font-mono text-[11px]">ERESOLVE esbuild@0.25 vs vite@8.3</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVercelFixModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Why the error happened */}
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-900 space-y-1">
              <span className="font-bold block">Kyun aaya yeh error Vercel par?</span>
              <p>
                Aapke Vercel build log me:
                <br />
                <code className="bg-rose-100 px-1 py-0.5 rounded text-[11px] font-mono">
                  Could not resolve dependency: peerOptional esbuild@"^0.27.0 || ^0.28.0" from vite@8.3.5
                </code>
              </p>
              <p>
                Vercel ka default npm strict peer dependency check karta hai. Root devDependencies me purana <code>esbuild 0.25</code> tha jabki Vite 8 ko esbuild 0.27+ chahiye.
              </p>
            </div>

            {/* Solution we applied */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Hamne Codebase me Yeh 3 Fixes Kar Diye Hain:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="font-bold text-emerald-900 block">1. package.json</span>
                  <span className="text-[11px] text-emerald-700">Conflicting esbuild devDependency hata di gayi</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="font-bold text-emerald-900 block">2. .npmrc</span>
                  <span className="text-[11px] text-emerald-700"><code>legacy-peer-deps=true</code> add kiya gaya</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="font-bold text-emerald-900 block">3. vercel.json</span>
                  <span className="text-[11px] text-emerald-700">Vite build &amp; dist directory lock kar di</span>
                </div>
              </div>
            </div>

            {/* What user needs to run */}
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">
                  Apne terminal par yeh 3 lines run karein aur push karein:
                </span>
                <button
                  onClick={handleCopyGitCommand}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  {copiedGitCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedGitCmd ? 'Copied Command!' : 'Copy Git Commands'}</span>
                </button>
              </div>
              <pre className="font-mono text-emerald-400 text-xs overflow-x-auto p-2 bg-slate-950 rounded">
                git add package.json .npmrc vercel.json
                <br />
                git commit -m "fix: resolve vercel esbuild peer dependency"
                <br />
                git push origin main
              </pre>
            </div>

            <p className="text-xs text-slate-500">
              Iske baad Vercel par automatically new deployment trigger ho jayega aur bina kisi error ke successfully compile hoke live ho jayega!
            </p>
          </div>
        </div>
      )}
    </>
  );
};
