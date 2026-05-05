import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { User, UserRole } from '../App';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

// Mock users for demo
const mockUsers: Record<string, { password: string; name: string; role: UserRole }> = {
  'admin': { password: '123', name: 'Admin User', role: 'Admin' },
  'user1': { password: '123', name: 'John Doe', role: 'User' },
  'accountant1': { password: '123', name: 'Jane Smith', role: 'Accountant' },
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const user = mockUsers[userId];
    if (user && user.password === password) {
      toast.success('Login successful!');
      onLogin({ id: userId, name: user.name, role: user.role });
    } else {
      toast.error('Invalid credentials. Try: admin/123');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden">
              <ImageWithFallback 
                src="/logo.png" 
                alt="Spécialisé Products Logo" 
                className="w-full h-full object-contain"
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-[#007BFF] hover:bg-[#0056b3]">
              Login
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-500">
            Demo: admin/123, user1/123, accountant1/123
          </div>
        </CardContent>
        <CardFooter className="justify-center pb-6">
          <p className="text-sm text-gray-500">© 2025 Spécialisé Products Private Limited</p>
        </CardFooter>
      </Card>
    </div>
  );
}