src/pages/index.tsx [1-100 of 1214] (truncated — use startLine/numLines to read remaining)
  1|import { home } from 'virtual:content';
  2|import { useState, useRef, useEffect, useCallback } from 'react';
  3|import { Helmet } from '@dr.pogodin/react-helmet';
  4|
  5|// ─── Types ───────────────────────────────────────────────────────────────────
  6|type Gender = 'ذكر' | 'أنثى' | 'آخر';
  7|type View = 'landing' | 'rooms' | 'chat' | 'store' | 'messages' | 'likes' | 'roles';
  8|type ActivePanel = null | 'menu' | 'users' | 'profile' | 'emoji' | 'extras' | 'draw' | 'colors' | 'youtube' | 'privateChat';
  9|type Role = 'owner' | 'admin' | 'manager' | 'moderator' | 'vip' | 'member' | 'guest';
 10|
 11|interface User {
 12|  id: string;
 13|  name: string;
 14|  gender: Gender;
 15|  age: number;
 16|  balance: number;
 17|  isGuest: boolean;
 18|  role?: Role;
 19|  membership?: 'ذهبية' | 'فضية' | null;
 20|}
 21|
 22|// ─── Role System ─────────────────────────────────────────────────────────────
 23|const ROLES: Record<Role, { label: string; icon: string; color: string; bg: string; rank: number }> = {
 24|  owner:    { label: 'المالك',        icon: '👑', color: '#fbbf24', bg: '#78350f', rank: 6 },
 25|  admin:    { label: 'الأدمن',        icon: '🌟', color: '#a78bfa', bg: '#4c1d95', rank: 5 },
 26|  manager:  { label: 'إدارة',         icon: '⭐', color: '#34d399', bg: '#064e3b', rank: 4 },
 27|  moderator:{ label: 'المشرف',        icon: '🛡️', color: '#60a5fa', bg: '#1e3a5f', rank: 3 },
 28|  vip:      { label: 'عضو مميز',      icon: '💎', color: '#f0c040', bg: '#1c1917', rank: 2 },
 29|  member:   { label: 'عضو',           icon: '🧑‍💼', color: '#94a3b8', bg: '#1e293b', rank: 1 },
 30|  guest:    { label: 'زائر',          icon: '👤', color: '#64748b', bg: '#0f172a', rank: 0 },
 31|};
 32|
 33|const ROLE_PERMISSIONS: Record<Role, {
 34|  canSendImages: boolean;
 35|  canSendYoutube: boolean;
 36|  canMute: boolean;
 37|  canKick: boolean;
 38|  canBan: boolean;
 39|  canDeleteMsg: boolean;
 40|  canOpenCloseRoom: boolean;
 41|  canPromote: boolean;
 42|  canEditAll: boolean;
 43|  canChangeName: boolean;
 44|  autoDelete: boolean;
 45|}> = {
 46|  owner:    { canSendImages:true,  canSendYoutube:true,  canMute:true,  canKick:true,  canBan:true,  canDeleteMsg:true,  canOpenCloseRoom:true,  canPromote:true,  canEditAll:true,  canChangeName:true,  autoDelete:false },
 47|  admin:    { canSendImages:true,  canSendYoutube:true,  canMute:true,  canKick:true,  canBan:false, canDeleteMsg:true,  canOpenCloseRoom:true,  canPromote:false, canEditAll:false, canChangeName:true,  autoDelete:false },
 48|  manager:  { canSendImages:true,  canSendYoutube:true,  canMute:true,  canKick:true,  canBan:false, canDeleteMsg:true,  canOpenCloseRoom:true,  canPromote:false, canEditAll:false, canChangeName:true,  autoDelete:false },
 49|  moderator:{ canSendImages:true,  canSendYoutube:true,  canMute:true,  canKick:false, canBan:false, canDeleteMsg:true,  canOpenCloseRoom:false, canPromote:false, canEditAll:false, canChangeName:true,  autoDelete:false },
 50|  vip:      { canSendImages:true,  canSendYoutube:true,  canMute:false, canKick:false, canBan:false, canDeleteMsg:false, canOpenCloseRoom:false, canPromote:false, canEditAll:false, canChangeName:true,  autoDelete:false },
 51|  member:   { canSendImages:false, canSendYoutube:false, canMute:false, canKick:false, canBan:false, canDeleteMsg:false, canOpenCloseRoom:false, canPromote:false, canEditAll:false, canChangeName:false, autoDelete:false },
 52|  guest:    { canSendImages:false, canSendYoutube:false, canMute:false, canKick:false, canBan:false, canDeleteMsg:false, canOpenCloseRoom:false, canPromote:false, canEditAll:false, canChangeName:false, autoDelete:true  },
 53|};
 54|
 55|function RoleBadge({ role, size = 'sm' }: { role: Role; size?: 'sm' | 'md' }) {
 56|  const r = ROLES[role];
 57|  const pad = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0 text-xs';
 58|  return (
 59|    <span className={`inline-flex items-center gap-0.5 rounded-full font-bold ${pad}`}
 60|      style={{ background: r.bg, color: r.color, border: `1px solid ${r.color}40` }}>
 61|      <span>{r.icon}</span>
 62|      <span>{r.label}</span>
 63|    </span>
 64|  );
 65|}
 66|
 67|interface Message {
 68|  id: string;
 69|  userId: string;
 70|  userName: string;
 71|  gender: Gender;
 72|  text: string;
 73|  time: string;
 74|  type?: 'system' | 'normal';
 75|}
 76|
 77|interface Room {
 78|  id: string;
 79|  name: string;
 80|  emoji: string;
 81|  online: number;
 82|}
 83|
 84|interface PrivateConv {
 85|  userId: string;
 86|  userName: string;
 87|  gender: Gender;
 88|  lastMsg: string;
 89|  time: string;
 90|}
 91|
 92|// ─── Constants ───────────────────────────────────────────────────────────────
 93|const ROOMS: Room[] = [
 94|  { id: 'general', name: 'غرفة العامة', emoji: '🌎', online: 47 },
 95|  { id: 'yemen', name: 'غرفة اليمن', emoji: '🌎', online: 83 },
 96|  { id: 'algeria', name: 'غرفة الجزائر', emoji: '🌎', online: 31 },
 97|  { id: 'egypt', name: 'غرفة مصر', emoji: '🌎', online: 62 },
 98|];
 99|
100|const MOCK_USERS: User[] = [