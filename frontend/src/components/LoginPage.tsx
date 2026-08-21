import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { toast } from 'sonner';
import ForgotPasswordFlow from './ForgotPasswordFlow';

interface LoginPageProps {
  onLogin: (employeeCode: string, password: string) => Promise<void>;
  loading?: boolean;
}

export default function LoginPage({ onLogin, loading = false }: LoginPageProps) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      await onLogin(userId.trim(), password);
      toast.success('Login successful!');
    } catch (error: any) {
      toast.error(error?.message || 'Invalid employee ID or password');
    } finally {
      setSubmitting(false);
    }
  };

  if (showForgotPassword) {
    return (
      <ForgotPasswordFlow
        onBackToLogin={() => {
          setShowForgotPassword(false);
          setPassword('');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="Company Logo"
                className="w-16 h-16 object-contain mb-2"
              />
            </div>
          </div>
          <h1 className="text-[#212529] font-bold">Spécialisé Products Private Limited</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="userId">Employee ID</Label>
              <Input
                id="userId"
                type="text"
                placeholder="Enter your employee ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-sm text-[#007BFF] hover:text-[#0056b3] hover:underline"
                  onClick={() => {
                    setPassword('');
                    setShowForgotPassword(true);
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative w-full">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-8"
                  required
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-0 z-10 flex h-9 translate-y-[-50%] items-center justify-center px-3 text-gray-500 hover:text-gray-700 cursor-pointer"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={submitting || loading} className="w-full bg-[#007BFF] hover:bg-[#0056b3]">
              {submitting || loading ? 'Please wait...' : 'Login'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center pb-6">
          <p className="text-sm text-gray-500">© 2025 Spécialisé Products Private Limited</p>
        </CardFooter>
      </Card>
    </div>
  );
}
