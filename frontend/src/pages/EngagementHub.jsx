import React, { useState, useEffect } from 'react';
import { hasPermission } from '../lib/permissions';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { 
  Megaphone, 
  Sparkles, 
  Heart, 
  Plus, 
  Bell, 
  ShieldCheck, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X, 
  Gift, 
  Rocket,
  CheckCircle2,
  Smile, 
  Sliders 
} from 'lucide-react';
import { CardSkeleton, ListSkeleton } from '../components/ui/Skeleton';
import { formatDistanceToNow, format } from 'date-fns';
import { io } from 'socket.io-client';
import { CommunicationReviewDialog } from '../components/communication/CommunicationReviewDialog';
import { IrisPostAnalysisModal } from '../components/communication/IrisPostAnalysisModal';
import { getCapabilities } from '../lib/communicationStressApi';

const CATEGORY_STYLES = {
  Urgent: { bg: 'bg-rose-50/90 text-rose-700 border-rose-200/90', icon: AlertTriangle },
  Birthday: { bg: 'bg-amber-50/90 text-amber-800 border-amber-200/90', icon: Gift },
  Policy: { bg: 'bg-blue-50/90 text-blue-700 border-blue-200/90', icon: ShieldCheck },
  Event: { bg: 'bg-purple-50/90 text-purple-700 border-purple-200/90', icon: Calendar },
  General: { bg: 'bg-[#F4F1EA] text-[#6B655C] border-[#EAE7E0]', icon: Info }
};

const EngagementHub = ({ user }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [preference, setPreference] = useState({ announceBirthday: true });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wishingId, setWishingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    category: 'General',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [canStressTest, setCanStressTest] = useState(false);

  const [selectedAnnouncementForAnalysis, setSelectedAnnouncementForAnalysis] = useState(null);
  const [isIrisAnalysisModalOpen, setIsIrisAnalysisModalOpen] = useState(false);

  const isAdmin = hasPermission(user, 'manage_organization');

  useEffect(() => {
    getCapabilities()
      .then(res => setCanStressTest(res.canStressTest))
      .catch(() => setCanStressTest(false));
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/announcements`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  };

  const fetchUserPreference = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPreference(data);
      }
    } catch (err) {
      console.error('Error fetching user preferences:', err);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.allSettled([fetchAnnouncements(), fetchUserPreference()]);
      } catch (err) {
        console.error('Error loading Engagement Hub data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();

    // Socket.io Real-time connection
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token: localStorage.getItem('token') }
    });

    socket.on('announcement:new', (newAnn) => {
      setAnnouncements(prev => [newAnn, ...prev]);
      showToast(`📢 New Announcement: ${newAnn.title}`);
    });

    socket.on('announcement:birthday', (bdayAnn) => {
      setAnnouncements(prev => [bdayAnn, ...prev]);
      showToast(`🎂 Birthday Celebration! ${bdayAnn.title}`);
    });

    socket.on('birthday:wish', ({ announcementId, wisherName }) => {
      setAnnouncements(prev => prev.map(ann => {
        if (ann.id === announcementId) {
          const existingWishes = ann.wishes || [];
          return {
            ...ann,
            wishes: [...existingWishes, { id: Date.now().toString(), wisher: { displayName: wisherName } }]
          };
        }
        return ann;
      }));
      showToast(`🎉 ${wisherName} wished a Happy Birthday!`);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleTogglePreference = async () => {
    const updatedValue = !preference.announceBirthday;
    setPreference(prev => ({ ...prev, announceBirthday: updatedValue }));
    try {
      const token = localStorage.getItem('token');
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/users/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ announceBirthday: updatedValue })
      });
      showToast(updatedValue ? '🎉 Birthday announcements enabled' : '🔒 Birthday announcements disabled');
    } catch (err) {
      console.error('Error updating preference:', err);
    }
  };

  const handleWish = async (announcementId) => {
    setWishingId(announcementId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/announcements/${announcementId}/wish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const wish = await res.json();
        setAnnouncements(prev => prev.map(ann => {
          if (ann.id === announcementId) {
            return {
              ...ann,
              wishes: [...(ann.wishes || []), { ...wish, wisherId: user?.id, wisher: { id: user?.id, displayName: user?.displayName } }]
            };
          }
          return ann;
        }));
        showToast('❤️ Your birthday wish was sent!');
      } else {
        const errData = await res.json();
        showToast(`⚠️ ${errData.error || 'Could not send wish'}`);
      }
    } catch (err) {
      console.error('Wish error:', err);
    } finally {
      setWishingId(null);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      setError('Title and message are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to post announcement');
      }

      setIsModalOpen(false);
      setFormData({ title: '', category: 'General', message: '' });
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualTrigger = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/announcements/trigger-birthday-check`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`🎂 Birthday check completed (${result.count || 0} celebrated)`);
        fetchAnnouncements();
      }
    } catch (err) {
      console.error('Manual trigger error:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <div className="h-9 w-64 bg-slate-200 rounded-lg" />
            <div className="h-4 w-72 bg-slate-100 rounded" />
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <ListSkeleton />
            <ListSkeleton />
            <ListSkeleton />
          </div>
          <div className="space-y-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const birthdayAnnouncements = announcements.filter(a => a.category === 'Birthday');

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto min-h-full flex flex-col gap-6">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F2B4D] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 border border-slate-700/60 font-display font-medium text-xs">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 border-b border-[#EAE7E0] gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-[#F0F3F9] border border-[#D0D9E8] text-[#1F2B4D] shadow-xs shrink-0">
            <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg min-[360px]:text-xl min-[410px]:text-2xl sm:text-3xl md:text-4xl text-[#1D1B16] tracking-tight leading-tight whitespace-nowrap">
              Engagement Hub
            </h1>
            <p className="text-[11px] sm:text-sm text-[#6B655C] mt-0.5 sm:mt-1 font-medium">Company announcements, celebrations & team feed.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isAdmin && canStressTest && (
            <Button 
              onClick={() => setIsReviewDialogOpen(true)}
              variant="ghost"
              className="flex-1 sm:flex-none justify-center whitespace-nowrap gap-1.5 font-display font-bold text-[#1F2B4D] hover:bg-amber-50 border border-amber-300 text-[11px] sm:text-xs rounded-xl px-2.5 sm:px-3.5 py-2 transition-all bg-amber-50/50 shadow-xs"
            >
              <ShieldCheck size={14} className="text-amber-700 shrink-0" />
              <span className="text-[#1F2B4D]">Review a Draft</span>
            </Button>
          )}
          {isAdmin && (
            <>
              <Button 
                onClick={handleManualTrigger}
                variant="outline"
                className="flex-1 sm:flex-none justify-center whitespace-nowrap gap-1.5 font-display font-bold text-[#6B655C] hover:bg-[#FAF8F5] border-[#EAE7E0] text-[11px] sm:text-xs rounded-xl px-2.5 sm:px-3.5 py-2 transition-all bg-white shadow-xs"
              >
                <Gift size={14} className="text-[#8C5722] shrink-0" /> 
                <span className="whitespace-nowrap">Birthday Check</span>
              </Button>
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="flex-1 sm:flex-none justify-center whitespace-nowrap bg-[#F0F3F9] hover:bg-[#E2E8F0] text-[#1F2B4D] border border-[#CBD5E1] font-display font-bold px-2.5 sm:px-4 py-2 rounded-xl shadow-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 text-[11px] sm:text-xs"
              >
                <Plus size={15} strokeWidth={2.5} className="shrink-0" /> 
                <span className="whitespace-nowrap">New Post</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Birthday Privacy Preference ── */}
      <div className="bg-[#FAF8F5] border border-[#EAE7E0] rounded-[18px] p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F0F3F9] border border-[#D0D9E8] text-[#1F2B4D] flex items-center justify-center shrink-0">
            <Gift size={18} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-display font-bold text-[#1D1B16] whitespace-nowrap">Birthday Broadcast</h3>
            <p className="text-[11px] sm:text-xs text-[#6B655C] font-medium mt-0.5">Allow your birthday to be announced on the company feed.</p>
          </div>
        </div>
        <button
          onClick={handleTogglePreference}
          className={`w-full sm:w-auto justify-center px-4 py-2 sm:py-2 rounded-xl text-xs font-display font-bold transition-all flex items-center gap-2 shrink-0 border ${
            preference.announceBirthday 
              ? 'bg-[#F0F3F9] text-[#1F2B4D] border-[#CBD5E1] shadow-xs' 
              : 'bg-[#F4F1EA] text-[#6B655C] border-[#EAE7E0] hover:bg-[#EAE7E0]'
          }`}
        >
          {preference.announceBirthday ? (
            <> <CheckCircle size={14} className="text-[#1F2B4D]" /> Announced </>
          ) : (
            <> <X size={14} className="text-[#6B655C]" /> Opted Out </>
          )}
        </button>
      </div>

      {/* ── Main Grid: Feed + Right Rail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Announcements Feed (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-3.5 rounded-full bg-[#1F2B4D]"></div>
            <h2 className="font-display font-bold text-[11px] text-[#6B655C] uppercase tracking-wider">Company Feed</h2>
          </div>

          {announcements.length === 0 ? (
            <div className="bg-white border border-dashed border-[#EAE7E0] rounded-[18px] p-10 text-center">
              <Megaphone size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-[#6B655C] font-display font-bold text-sm">No announcements posted yet.</p>
              <p className="text-[#9A948A] text-xs mt-1 font-medium">Check back later for company updates.</p>
            </div>
          ) : (
            announcements.map((ann) => {
              const CategoryIcon = CATEGORY_STYLES[ann.category]?.icon || Info;
              const categoryStyle = CATEGORY_STYLES[ann.category]?.bg || CATEGORY_STYLES.General.bg;
              const isBirthday = ann.category === 'Birthday';
              const wishes = ann.wishes || [];
              const hasWished = wishes.some(w => w.wisherId === user?.id || w.wisher?.id === user?.id);

              return (
                <div key={ann.id} className="bg-white border border-[#EAE7E0] rounded-[18px] p-4 sm:p-5 shadow-xs hover:border-[#D8D4CA] hover:shadow-sm transition-all relative overflow-hidden group">
                  
                  {/* Category Badge & Timestamp */}
                  <div className="flex items-center justify-between mb-3.5 gap-2 flex-wrap sm:flex-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-display font-bold uppercase tracking-wider border ${categoryStyle}`}>
                      <CategoryIcon size={12} />
                      {ann.category}
                    </span>
                    <span className="text-[11px] text-[#9A948A] font-medium">
                      {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif font-semibold text-base sm:text-lg text-[#1D1B16] leading-snug tracking-tight mb-2">{ann.title}</h3>

                  {/* Body */}
                  <p className="text-[#6B655C] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap mb-5 font-medium">{ann.message}</p>

                  {/* Author & Wish Interaction */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-[#F4F1EA] gap-3">
                    <div className="flex items-center gap-2.5">
                      {ann.admin ? (
                        <>
                          <Avatar src={ann.admin.avatar} name={ann.admin.displayName} className="w-7 h-7 rounded-full ring-2 ring-[#FAF9F6]" />
                          <span className="text-[11px] font-display font-bold text-[#1D1B16]">{ann.admin.displayName}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-7 h-7 rounded-full bg-[#F0F3F9] text-[#1F2B4D] border border-[#D0D9E8] flex items-center justify-center font-display font-bold text-[9px]">
                            HR
                          </div>
                          <span className="text-[11px] font-display font-bold text-[#1D1B16] flex items-center gap-1.5">
                            Crew System <span className="inline-flex px-1.5 py-0.5 rounded-md bg-[#FAF9F6] text-[#6B655C] border border-[#EAE7E0] text-[9px] font-bold uppercase tracking-wider">Official</span>
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedAnnouncementForAnalysis(ann);
                          setIsIrisAnalysisModalOpen(true);
                        }}
                        className="bg-indigo-50 hover:bg-indigo-100/90 text-indigo-800 border border-indigo-200 font-display font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                      >
                        <Sparkles size={13} className="text-indigo-600 shrink-0" />
                        <span>Analyze with Iris AI</span>
                      </Button>

                      {/* Birthday Wish Interaction */}
                      {isBirthday && (
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          {wishes.length > 0 && (
                            <span className="text-[11px] font-medium text-[#6B655C]">
                              {hasWished ? `You and ${wishes.length - 1} others wished` : `${wishes.length} wishes`}
                            </span>
                          )}
                          <Button
                            size="sm"
                            disabled={hasWished || wishingId === ann.id}
                            onClick={() => handleWish(ann.id)}
                            className={`gap-1.5 font-display font-bold text-xs rounded-xl transition-all px-3.5 py-1.5 ${
                              hasWished 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200 cursor-not-allowed'
                                : 'bg-[#FDF2F8] hover:bg-[#FCE7F3] text-[#9D174D] border border-[#FBCFE8] shadow-xs hover:scale-[1.02] active:scale-95'
                            }`}
                          >
                            <Heart size={13} className={hasWished ? 'fill-rose-700' : ''} />
                            {hasWished ? 'Wished' : 'Send Wish'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Right Rail: Birthday Spotlight ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-3.5 rounded-full bg-[#8C5722]"></div>
            <h2 className="font-display font-bold text-[11px] text-[#6B655C] uppercase tracking-wider">Birthday Spotlight</h2>
          </div>

          <div className="bg-gradient-to-br from-[#FAF7F2] via-[#F5EFE6] to-[#EFE7DC] border border-[#E2D9CC] rounded-[18px] p-5 shadow-xs relative overflow-hidden">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-display font-bold bg-[#FDF8F3] text-[#8C5722] border border-[#EEDCCE] mb-4 uppercase tracking-wider">
                <Sparkles size={12} className="text-[#B5793A]" /> Today's Celebration
              </div>
              <h3 className="font-serif font-bold text-xl text-[#1D1B16] leading-snug tracking-tight mb-2">Spread The Joy</h3>
              <p className="text-[#6B655C] text-xs leading-relaxed font-medium">
                {birthdayAnnouncements.length > 0
                  ? 'Check the feed for today\'s birthday posts and send your best wishes!'
                  : 'No team birthdays today. Keep an eye out for upcoming celebrations.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Admin: New Announcement Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[22px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 border border-[#EAE7E0]">
            <div className="flex items-center justify-between p-5 border-b border-[#EAE7E0] bg-[#FAF8F5]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#F0F3F9] border border-[#D0D9E8] text-[#1F2B4D]">
                  <Megaphone size={16} />
                </div>
                <h2 className="font-serif font-bold text-xl text-[#1D1B16] tracking-tight">Compose Announcement</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-[#6B655C] hover:text-[#1D1B16] hover:bg-[#EAE7E0] rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="p-5 space-y-4 overflow-y-auto">
              {error && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2 font-medium">
                  <Info size={14} className="shrink-0" /> {error}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1.5">Title</label>
                <Input 
                  value={formData.title} 
                  onChange={e => setFormData({ ...formData, title: e.target.value })} 
                  placeholder="e.g. Q3 Townhall Meeting Scheduled"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1.5">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-2.5 border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] focus:border-[#1F2B4D] outline-none text-sm text-[#1D1B16] font-medium bg-white transition-colors"
                >
                  <option value="General">General</option>
                  <option value="Policy">Policy</option>
                  <option value="Event">Event</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-display font-bold text-[#6B655C] uppercase tracking-wider mb-1.5">Message</label>
                <textarea
                  rows={4}
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Write your announcement details here..."
                  className="w-full p-3 border border-[#EAE7E0] rounded-xl focus:ring-2 focus:ring-[#1F2B4D] focus:border-[#1F2B4D] outline-none text-sm text-[#1D1B16] font-medium transition-colors"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#EAE7E0]">
                {canStressTest && (
                  <Button 
                    type="button" 
                    variant="ghost"
                    onClick={() => setIsReviewDialogOpen(true)}
                    className="bg-amber-50 hover:bg-amber-100/90 text-amber-950 border border-amber-300 font-display font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <ShieldCheck size={15} className="text-amber-700 shrink-0" />
                    <span className="text-amber-950 font-bold">Stress-test</span>
                  </Button>
                )}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="text-[#6B655C] font-display font-bold text-xs rounded-xl px-4 py-2 hover:bg-[#F4F1EA]">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-[#F0F3F9] hover:bg-[#E2E8F0] text-[#1F2B4D] border border-[#CBD5E1] font-display font-bold text-xs px-5 py-2 rounded-xl shadow-xs transition-all hover:scale-[1.02] active:scale-95">
                    {submitting ? 'Broadcasting...' : 'Broadcast'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stress-Test Review Dialog */}
      <CommunicationReviewDialog
        isOpen={isReviewDialogOpen}
        onClose={() => setIsReviewDialogOpen(false)}
        initialDraft={formData}
        onApplyRewrite={(rewriteText) => setFormData({ ...formData, message: rewriteText })}
        readOnly={!isAdmin}
      />

      {/* Employee Iris Post Analysis Modal */}
      <IrisPostAnalysisModal
        isOpen={isIrisAnalysisModalOpen}
        onClose={() => setIsIrisAnalysisModalOpen(false)}
        announcement={selectedAnnouncementForAnalysis}
      />
    </div>
  );
};

export default EngagementHub;
