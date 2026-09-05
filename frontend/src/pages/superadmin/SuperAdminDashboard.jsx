import React, { useState, useEffect } from 'react';
import { Plus, Activity, Building, Users, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import ProvisionTenantModal from './ProvisionTenantModal';
import TenantDetailsModal from './TenantDetailsModal';
import Alert from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Skeleton } from '../../components/ui/Skeleton';

const SuperAdminDashboard = () => {
  const [tenants, setTenants] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const navigate = useNavigate();

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/superadmin/tenants`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch tenants');
      }
      const data = await res.json();
      setTenants(data);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.domain && t.domain.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col text-[#1D1B16] font-sans selection:bg-[#1F2B4D] selection:text-white">
      
      {/* Super Admin Top Navigation */}
      <header className="h-16 bg-white border-b border-[#EAE7E0] flex items-center justify-between px-6 shrink-0 z-40 sticky top-0">
        <div className="flex items-center gap-3">
          <img src="/crew-new.png" alt="Crew HR" className="h-8 object-contain" />
          <div className="h-4 w-px bg-[#EAE7E0] mx-2"></div>
          <span className="font-serif font-bold text-[#1F2B4D] tracking-tight">Platform Admin</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 mr-2">
            <div className="w-9 h-9 rounded-full bg-[#F4F1EA] border border-[#EAE7E0] flex items-center justify-center text-[#1F2B4D] font-bold text-sm shadow-inner shrink-0">
              {user?.displayName ? (user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()) : 'SA'}
            </div>
            <div className="flex flex-col text-sm min-w-0">
              <span className="font-bold text-[#1F2B4D] leading-tight break-words whitespace-normal">{user?.displayName || 'Super Admin'}</span>
              <span className="text-xs text-[#6B655C] font-medium leading-tight break-words whitespace-normal">{user?.email || 'admin@crew.com'}</span>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="text-[#6B655C] hover:text-[#B5793A] hover:bg-[#FDF8F3] p-2.5 rounded-xl transition-all"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-4 md:p-8 lg:p-12 relative flex-1 flex flex-col max-w-7xl mx-auto w-full">
        
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold text-[#1F2B4D] tracking-tight">Organizations</h1>
            <p className="text-[#6B655C] mt-2 font-medium text-sm">Manage all companies, their CEOs, and platform health.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl bg-white border border-[#EAE7E0] focus:border-[#1F2B4D] focus:ring-4 focus:ring-[#1F2B4D]/10 px-4 py-2.5 text-sm font-medium text-[#1F2B4D] placeholder-[#9A948A] transition-all outline-none"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="bg-[#1F2B4D] hover:bg-[#141C33] text-white rounded-xl gap-2 justify-center w-full sm:w-auto shadow-md hover:shadow-lg transition-all duration-500 flex items-center px-5 py-2.5 font-bold text-sm"
              style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
              <Plus size={18} strokeWidth={3} /> Provision Tenant
            </button>
          </div>
        </div>

        {errorMsg && <Alert type="error" message={errorMsg} className="mb-6 rounded-xl border-red-200" />}

        {/* Stats Grid - Doppelrand Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 shrink-0">
          <div className="p-2 rounded-[24px] bg-[#F4F1EA] shadow-sm">
            <div className="bg-white p-6 rounded-[16px] border border-[#EAE7E0] h-full transition-all duration-500 group hover:-translate-y-1 hover:shadow-[0_12px_32px_-6px_rgba(29,27,22,0.10)]" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#F0F3F9] rounded-xl text-[#1F2B4D] group-hover:scale-110 transition-transform duration-500">
                  <Building size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-[10px] font-bold text-[#6B655C] uppercase tracking-widest">Total Companies</h3>
              </div>
              {loading ? <Skeleton className="h-10 w-20 rounded-lg bg-[#F4F1EA]" /> : <p className="text-4xl font-serif font-bold text-[#1F2B4D]">{tenants.length}</p>}
            </div>
          </div>
          
          <div className="p-2 rounded-[24px] bg-[#F4F1EA] shadow-sm">
            <div className="bg-white p-6 rounded-[16px] border border-[#EAE7E0] h-full transition-all duration-500 group hover:-translate-y-1 hover:shadow-[0_12px_32px_-6px_rgba(29,27,22,0.10)]" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#F0F3F9] rounded-xl text-[#1F2B4D] group-hover:scale-110 transition-transform duration-500">
                  <Users size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-[10px] font-bold text-[#6B655C] uppercase tracking-widest">Total Users</h3>
              </div>
              {loading ? <Skeleton className="h-10 w-24 rounded-lg bg-[#F4F1EA]" /> : <p className="text-4xl font-serif font-bold text-[#1F2B4D]">
                {tenants.reduce((acc, t) => acc + (t._count?.users || 0), 0)}
              </p>}
            </div>
          </div>
          
          <div className="p-2 rounded-[24px] bg-[#F4F1EA] shadow-sm">
            <div className="bg-white p-6 rounded-[16px] border border-[#EAE7E0] h-full transition-all duration-500 group hover:-translate-y-1 hover:shadow-[0_12px_32px_-6px_rgba(29,27,22,0.10)]" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-[#ECFDF5] rounded-xl text-[#065F46] group-hover:scale-110 transition-transform duration-500">
                  <Activity size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-[10px] font-bold text-[#6B655C] uppercase tracking-widest">System Health</h3>
              </div>
              {loading ? <Skeleton className="h-8 w-36 mt-4 rounded-lg bg-[#F4F1EA]" /> : <p className="text-xl font-bold text-[#065F46] mt-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse ring-4 ring-[#A7F3D0]"></span>
                Operational
              </p>}
            </div>
          </div>
        </div>

        {/* Table Area (glass-panel container for the list) */}
        <div className="flex-1 p-2 rounded-[24px] bg-[#F4F1EA] flex flex-col min-h-0 relative">
          <div className="flex-1 bg-white rounded-[16px] border border-[#EAE7E0] overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: 0, border: 'none' }}>
                <thead className="sticky top-0 bg-[#FAF9F6] z-10 border-b border-[#EAE7E0] shadow-sm">
                  <tr className="text-[#6B655C] text-[10px] font-bold uppercase tracking-widest">
                    <th className="py-4 px-6 border-b border-[#EAE7E0]">Company Name</th>
                    <th className="py-4 px-6 border-b border-[#EAE7E0] hidden md:table-cell">Domain</th>
                    <th className="py-4 px-6 border-b border-[#EAE7E0]">CEO / Owner</th>
                    <th className="py-4 px-6 border-b border-[#EAE7E0]">Plan Tier</th>
                    <th className="py-4 px-6 border-b border-[#EAE7E0] hidden md:table-cell text-right">Active Users</th>
                    <th className="py-4 px-6 border-b border-[#EAE7E0] hidden lg:table-cell text-right">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE7E0]">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        <td className="py-5 px-6"><Skeleton className="h-5 w-32 rounded bg-[#F4F1EA]" /></td>
                        <td className="py-5 px-6 hidden md:table-cell"><Skeleton className="h-5 w-40 rounded bg-[#F4F1EA]" /></td>
                        <td className="py-5 px-6">
                           <div className="flex items-center gap-3">
                              <Skeleton className="h-9 w-9 rounded-full bg-[#F4F1EA]" />
                              <Skeleton className="h-5 w-28 rounded bg-[#F4F1EA]" />
                           </div>
                        </td>
                        <td className="py-5 px-6"><Skeleton className="h-6 w-16 rounded-full bg-[#F4F1EA]" /></td>
                        <td className="py-5 px-6 hidden md:table-cell text-right"><Skeleton className="h-5 w-8 ml-auto rounded bg-[#F4F1EA]" /></td>
                        <td className="py-5 px-6 hidden lg:table-cell text-right"><Skeleton className="h-5 w-20 ml-auto rounded bg-[#F4F1EA]" /></td>
                      </tr>
                    ))
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-24 text-center">
                        <div className="flex flex-col items-center justify-center text-[#9A948A]">
                          <Building size={48} className="mb-4 opacity-20" />
                          <p className="text-lg font-medium text-[#6B655C]">No organizations found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => {
                      const ceoName = tenant.users && tenant.users.length > 0 ? tenant.users[0].displayName : 'No CEO assigned';
                      return (
                        <tr 
                          key={tenant.id} 
                          className="hover:bg-[#FAF9F6] transition-colors cursor-pointer group"
                          onClick={() => setSelectedTenantId(tenant.id)}
                        >
                          <td className="py-4 px-6">
                            <div className="font-bold text-[#1F2B4D]">{tenant.name}</div>
                          </td>
                          <td className="py-4 px-6 text-sm font-medium text-[#6B655C] hidden md:table-cell">{tenant.domain || 'N/A'}</td>
                          <td className="py-4 px-6">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white border border-slate-700/60 flex items-center justify-center text-xs font-bold shadow-xs">
                                  {ceoName.substring(0,2).toUpperCase()}
                                </div>
                                <span className="text-sm font-semibold text-[#1D1B16]">{ceoName}</span>
                             </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              tenant.planTier === 'Enterprise' 
                                ? 'bg-[#1F2B4D] text-white border border-[#141C33]' 
                                : 'bg-[#F4F1EA] text-[#1D1B16] border border-[#EAE7E0]'
                            }`}>
                              {tenant.planTier || 'Free'}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-bold text-[#1F2B4D] hidden md:table-cell text-right">
                             {tenant._count?.users || 0}
                          </td>
                          <td className="py-4 px-6 text-sm font-medium text-[#6B655C] hidden lg:table-cell text-right">
                            {new Date(tenant.createdAt).toLocaleDateString('en-IN')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isModalOpen && (
          <ProvisionTenantModal 
            onClose={() => setIsModalOpen(false)} 
            onSuccess={() => {
              setIsModalOpen(false);
              fetchTenants();
            }}
          />
        )}

        {selectedTenantId && (
          <TenantDetailsModal 
            tenantId={selectedTenantId} 
            onClose={() => {
              setSelectedTenantId(null);
              fetchTenants();
            }} 
          />
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
