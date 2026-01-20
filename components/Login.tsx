import React, { useState } from 'react';
import { authenticateUser } from '../services/storageService';
import { Member } from '../types';
import { ArrowRight, AlertCircle, Users, Sparkles } from 'lucide-react';
import { sanitizeInput } from '../services/securityService';

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

    const cleanName = sanitizeInput(name);

    try {
        const result = await authenticateUser(cleanName, passcode);
        if (result.success && result.member) {
            onLogin(result.member);
        } else {
            setError(result.message || 'Login failed');
        }
    } catch (err) {
        setError('An unexpected error occurred.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-5xl flex overflow-hidden z-10 min-h-[600px] border border-white/50">
        
        {/* Left Side - Visual */}
        <div className="hidden md:flex w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 p-12 flex-col justify-between text-white relative">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div>
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                    <Sparkles className="text-white" size={24} />
                </div>
                <h1 className="text-4xl font-bold mb-4">Children's Ministry<br/>Attendance</h1>
                <p className="text-indigo-100 text-lg leading-relaxed opacity-90">
                    Seamlessly track attendance, manage members, and generate insights for a thriving family.
                </p>
            </div>
            <div className="text-sm text-indigo-200 opacity-60">
                © {new Date().getFullYear()} CM Ministry System v5.0
            </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
            <div className="max-w-sm mx-auto w-full">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm md:hidden">
                        <Users size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                    <p className="text-gray-500 mt-2">Please sign in to continue</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Full Name</label>
                        <input 
                            type="text" 
                            placeholder="e.g. John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-200"
                            required
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Access Code</label>
                        <input 
                            type="password" 
                            placeholder="••••"
                            value={passcode}
                            onChange={(e) => setPasscode(e.target.value)}
                            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white outline-none transition-all duration-200 font-mono tracking-widest text-lg"
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 border border-red-100">
                            <AlertCircle size={20} className="shrink-0" />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                    >
                        {isLoading ? 'Verifying...' : 'Sign In'}
                        {!isLoading && <ArrowRight size={20} />}
                    </button>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;