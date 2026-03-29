import { Drawer, Box, Typography, Chip, Divider, IconButton, Skeleton, Avatar } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery } from '@tanstack/react-query';
import { useUserStore } from '../stores/useUserStore';
import { getUserById } from '../api/adminApi';
import { ROLE_COLORS } from './constants';
import { format } from 'date-fns';

const InfoRow = ({ label, value }) => (
  <Box sx={{ display:'flex', justifyContent:'space-between', py:1, borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
    <Typography sx={{ fontSize:12, color:'rgba(15,23,42,0.5)' }}>{label}</Typography>
    <Typography sx={{ fontSize:13, color:'rgba(15,23,42,0.85)', textAlign:'right', maxWidth:'60%' }}>{value ?? '—'}</Typography>
  </Box>
);

export default function UserDetailDrawer() {
  const { drawerUserId, closeDrawer } = useUserStore();
  const open = Boolean(drawerUserId);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', drawerUserId],
    queryFn: () => getUserById(drawerUserId),
    enabled: open,
  });

  const role = user?.userRole?.roleName ?? 'VIEWER';

  return (
    <Drawer anchor="right" open={open} onClose={closeDrawer}
      PaperProps={{ sx:{ width:{ xs:'100vw', sm:420 }, bgcolor:'#ffffff', borderLeft:'1px solid rgba(0,0,0,0.08)', color:'#0f172a' } }}>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', p:2, borderBottom:'1px solid rgba(0,0,0,0.07)' }}>
        <Typography sx={{ fontWeight:700, fontSize:16, color:'#0f172a' }}>User Details</Typography>
        <IconButton onClick={closeDrawer} sx={{ color:'rgba(15,23,42,0.45)' }}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ p:2, overflowY:'auto', flex:1 }}>
        {isLoading ? (
          <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
            <Skeleton variant="circular" width={64} height={64} sx={{ bgcolor:'rgba(0,0,0,0.07)', mx:'auto' }} />
            {Array.from({ length:8 }).map((_, i) => <Skeleton key={i} height={36} sx={{ bgcolor:'rgba(0,0,0,0.06)' }} />)}
          </Box>
        ) : user && (
          <>
            <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', mb:3, gap:1 }}>
              <Avatar sx={{ width:64, height:64, bgcolor:'#0d9488', fontSize:24, fontWeight:700 }}>
                {(user.firstName?.[0] ?? '?').toUpperCase()}
              </Avatar>
              <Typography sx={{ fontWeight:700, fontSize:18, color:'#0f172a' }}>{user.firstName} {user.lastName}</Typography>
              <Chip label={role} size="small" sx={{ bgcolor:`${ROLE_COLORS[role]}18`, color:ROLE_COLORS[role], fontWeight:700 }} />
            </Box>
            <Typography sx={{ fontSize:11, textTransform:'uppercase', letterSpacing:.8, color:'rgba(15,23,42,0.35)', mb:1 }}>Profile</Typography>
            <InfoRow label="Email"   value={user.email} />
            <InfoRow label="Mobile"  value={user.mobileNo} />
            <InfoRow label="Gender"  value={user.gender} />
            <InfoRow label="DOB"     value={user.dob ? format(new Date(user.dob), 'dd MMM yyyy') : null} />
            <InfoRow label="Logins"  value={user.noOfLogin} />
            <InfoRow label="Created" value={user.creationDate ? format(new Date(user.creationDate), 'dd MMM yyyy') : null} />
            {user.loginData?.length > 0 && (
              <>
                <Divider sx={{ my:2, borderColor:'rgba(0,0,0,0.07)' }} />
                <Typography sx={{ fontSize:11, textTransform:'uppercase', letterSpacing:.8, color:'rgba(15,23,42,0.35)', mb:1 }}>Login History</Typography>
                {user.loginData.slice(0,5).map((l, i) => (
                  <Box key={i} sx={{ py:.75, borderBottom:'1px solid rgba(0,0,0,0.05)', fontSize:12, color:'rgba(15,23,42,0.6)' }}>
                    {l.loginTime ? format(new Date(l.loginTime), 'dd MMM yyyy, HH:mm') : '—'} · {l.ipAddress ?? 'unknown'}
                  </Box>
                ))}
              </>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
