import React, { useState } from 'react';
import { authenticateUser } from '../services/storageService';
import { Member } from '../types';
import { Lock, ArrowRight, AlertCircle, Users, Sparkles } from 'lucide-react';

interface LoginProps {
  onLogin: (user: Member) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        const result = await authenticateUser(name.trim(), passcode);
        if (result.success && result.member) {
            onLogin(result.member);
        } else {
            setError(result.message || 'Login failed');
        }
    } catch (e) {
        setError('An unexpected error occurred.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center p-4 overflow-hidden">
      {/* Abstract Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-soft w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-10">
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <Users size={40} className="text-indigo-600" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-1.5 rounded-full border-4 border-white">
                    <Sparkles size={12} />
                </div>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 mt-6 tracking-tight">Welcome Back</h1>
            <p className="text-gray-500 text-sm mt-2 font-medium">Children's Ministry Attendance</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Your Name</label>
                <input 
                    type="text" 
                    placeholder="e.g. Sarah Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-4 bg-gray-50/50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all placeholder:text-gray-400 font-medium"
                    required
                />
            </div>
            
            <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Passcode</label>
                <div className="relative">
                    <input 
                        type="password" 
                        placeholder="••••"
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        className="w-full p-4 pl-12 bg-gray-50/50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all tracking-[0.5em] font-bold text-gray-800"
                        required
                    />
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                </div>
            </div>

            {error && (
                <div className="bg-red-50/80 backdrop-blur-sm text-red-600 p-4 rounded-xl text-sm flex items-center gap-3 border border-red-100 animate-in slide-in-from-top-2">
                    <AlertCircle size={18} className="shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-6"
            >
                {isLoading ? 'Verifying...' : 'Access Dashboard'}
                {!isLoading && <ArrowRight size={20} />}
            </button>
        </form>

        <div className="mt-10 text-center">
            <p className="text-xs font-medium text-gray-400">
                Secure System 2026
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;