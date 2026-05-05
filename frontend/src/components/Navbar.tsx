import { LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { User } from '../App';

interface NavbarProps {
  user: User;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  return (
    <nav className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
          <ImageWithFallback 
            src="/logo.png" 
            alt="Spécialisé Products Logo" 
            className="w-full h-full object-contain"
          />
        </div>
        <span className="text-[#212529]">Spécialisé Products Private Limited</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          <span className="text-[#007BFF]">{user.name}</span> ({user.role})
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onLogout}
          className="text-gray-600 hover:text-[#007BFF]"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </nav>
  );
}
