import React, { useState } from 'react';
import { authenticateUser } from '../services/storageService';
import { Member } from '../types';
import { Lock, ArrowRight, AlertCircle, Users } from 'lucide-react';
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

    // Sanitize name before sending to auth
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Users size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-500 text-sm mt-1">Attendance System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input 
                    type="text" 
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                    required
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passcode</label>
                <input 
                    type="password" 
                    placeholder="Enter 4-digit code"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all tracking-widest font-mono"
                    required
                />
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none mt-4"
            >
                {isLoading ? 'Verifying...' : 'Login'}
                {!isLoading && <ArrowRight size={18} />}
            </button>
        </form>

    
      </div>
    </div>
  );
};

export default Login;