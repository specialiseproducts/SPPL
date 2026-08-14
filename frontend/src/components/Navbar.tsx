import { Bell, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import type { User } from '../App';
import { useEffect, useRef, useState } from 'react';
import NotificationCenter from './NotificationCenter';
import NotificationExperienceHost from './notifications/NotificationExperienceHost';
import { useUnreadNotificationCountQuery } from '../hooks/notifications/useNotificationsQueries';
import { OPEN_CENTER_EVENT } from '../utils/browserNotifications';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  onProfile?: () => void;
  onModuleSelect?: (moduleId: string) => void;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]?.toUpperCase() || '').slice(0, 2).join('');
}

export default function Navbar({ user, onLogout, onProfile, onModuleSelect }: NavbarProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadQuery = useUnreadNotificationCountQuery(true);
  const unreadCount = Number(unreadQuery.data || 0);
  const showBadge = unreadCount > 0;
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const lastBadgeLabelRef = useRef(badgeLabel);
  if (showBadge) lastBadgeLabelRef.current = badgeLabel;
  const displayedBadgeLabel = showBadge ? badgeLabel : lastBadgeLabelRef.current;
  const wideBadge = displayedBadgeLabel.length > 1;

  useEffect(() => {
    const onOpen = () => setNotificationsOpen(true);
    window.addEventListener(OPEN_CENTER_EVENT, onOpen as EventListener);
    return () => window.removeEventListener(OPEN_CENTER_EVENT, onOpen as EventListener);
  }, []);

  return (
    <>
      <NotificationExperienceHost enabled />
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
            <img
              src={user.profilePhoto}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover border"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full bg-[#007BFF] text-white text-xs flex items-center justify-center"
              aria-hidden
            >
              {initials(user.name)}
            </div>
          )}
          <div className="relative h-9 w-9 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 shrink-0 overflow-visible rounded-md text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-[#007BFF] active:bg-gray-200 active:scale-[0.97] focus-visible:ring-[#007BFF]/30"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : 'Notifications'
              }
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <Bell className="h-5 w-5 shrink-0" aria-hidden />
                <span
                  className={`pointer-events-none absolute z-10 flex items-center justify-center rounded-full border-2 border-white font-bold leading-none tabular-nums transition-[transform,opacity,min-width] duration-200 ease-out ${
                    wideBadge ? 'h-[20px] min-w-[24px] px-1 max-md:h-[18px] max-md:min-w-[20px]' : 'h-[20px] w-[20px] min-w-[20px] max-md:h-[18px] max-md:w-[18px] max-md:min-w-[18px]'
                  } ${showBadge ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                  style={{
                    top: -5,
                    right: -5,
                    color: '#ffffff',
                    backgroundColor: '#DC2626',
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                  aria-hidden
                >
                  {displayedBadgeLabel}
                </span>
              </span>
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={onProfile}>
            Profile
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="text-gray-600 hover:text-[#007BFF]"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </nav>

      <NotificationCenter
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        onModuleSelect={(moduleId) => onModuleSelect?.(moduleId)}
      />
    </>
  );
}
