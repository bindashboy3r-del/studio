
"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { format, isValid } from "date-fns";
import { ChevronLeft, RefreshCw, User as UserIcon, Mail } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";

export default function AllUsersPage() {
  const { user: admin, isUserLoading } = useUser();
  const db = useFirestore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && (!admin || admin.email !== "chetanmadhav4@gmail.com")) {
      router.push("/admin/login");
    }
  }, [admin, isUserLoading, router]);

  useEffect(() => {
    if (!admin || !db) return;

    // Use a simple query without orderBy to avoid index errors
    const q = query(collection(db, "users"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usrs = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        
        // Robust date parsing
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else {
            const parsed = new Date(data.createdAt);
            if (isValid(parsed)) createdAt = parsed;
          }
        }

        return {
          id: doc.id,
          ...data,
          createdAt
        };
      });

      // Client-side sort to ensure consistent order without composite index
      usrs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setUsers(usrs);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [admin, db]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/admin")}
            className="p-3 bg-white rounded-2xl text-slate-400 hover:text-[#312ECB] shadow-sm transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#111B21]">ALL USERS</h1>
            <p className="text-[10px] font-black text-[#312ECB] uppercase tracking-widest">Database & Contact List</p>
          </div>
        </header>

        <main className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-slate-100 hover:bg-transparent">
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">User Profile</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Contact Info</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6 text-right">Registered On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <UserIcon size={18} />
                      </div>
                      <span className="font-bold text-slate-800">{u.displayName || 'Anonymous User'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Mail size={14} />
                      <span className="text-sm font-medium">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[11px] font-bold text-slate-400 uppercase">
                    {isValid(u.createdAt) ? format(u.createdAt, 'MMM dd, yyyy') : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </main>
      </div>
    </div>
  );
}
