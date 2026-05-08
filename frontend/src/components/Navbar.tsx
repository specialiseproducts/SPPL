import { LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { User } from '../App';
import { useState } from 'react';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onProfile?: () => void;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]?.toUpperCase() || '').slice(0, 2).join('');
}

export default function Navbar({ user, onLogout, onProfile }: NavbarProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
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
          <span className="text-[#007BFF]">{user.name}</span>
        </span>
        {user.profilePhoto && !photoFailed ? (
          <img src={user.profilePhoto} alt={user.name} className="w-8 h-8 rounded-full object-cover border" onError={() => setPhotoFailed(true)} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#007BFF] text-white text-xs flex items-center justify-center">
            {initials(user.name)}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onProfile}
        >
          Profile
        </Button>
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
