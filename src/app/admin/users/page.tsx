
"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, isValid } from "date-fns";
import { ChevronLeft, RefreshCw, User as UserIcon, Mail, Wallet, Pencil, Save, X } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export default function AllUsersPage() {
  const { user: admin, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newBalance, setNewBalance] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
  const ADMIN_ID = "s55uL0f8PmcypR75usVYOLwVs7O2";

  useEffect(() => {
    if (!isUserLoading && (!admin || (admin.email !== ADMIN_EMAIL && admin.uid !== ADMIN_ID))) {
      router.push("/admin/login");
    }
  }, [admin, isUserLoading, router]);

  useEffect(() => {
    if (!admin || !db) return;

    const q = query(collection(db, "users"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usrs = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        
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

      usrs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setUsers(usrs);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [admin, db]);

  const handleUpdateBalance = async () => {
    if (!db || !editingUser) return;
    const balanceNum = parseFloat(newBalance);
    if (isNaN(balanceNum)) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid number." });
      return;
    }

    setIsUpdating(true);
    try {
      const userRef = doc(db, "users", editingUser.id);
      await updateDoc(userRef, {
        balance: balanceNum,
        balanceUpdatedAt: serverTimestamp(),
        balanceUpdatedBy: admin?.email
      });

      toast({ title: "Balance Updated", description: `Wallet for ${editingUser.displayName || editingUser.email} is now ₹${balanceNum}.` });
      setEditingUser(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update user balance." });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-body">
      <div className="max-w-5xl mx-auto space-y-6">
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
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-6">Wallet Balance</TableHead>
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
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                        <Wallet size={14} className="text-emerald-600" />
                        <span className="text-sm font-black text-emerald-700">₹{(u.balance || 0).toFixed(0)}</span>
                      </div>
                      <Dialog open={editingUser?.id === u.id} onOpenChange={(open) => {
                        if (open) {
                          setEditingUser(u);
                          setNewBalance((u.balance || 0).toString());
                        } else {
                          setEditingUser(null);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#312ECB] hover:bg-blue-50">
                            <Pencil size={14} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[400px] rounded-[2.5rem] border-none shadow-2xl p-8">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                              <Wallet className="text-[#312ECB]" /> Edit Balance
                            </DialogTitle>
                          </DialogHeader>
                          <div className="py-6 space-y-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Current User</p>
                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="font-bold text-[#111B21]">{u.displayName || u.email}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">New Balance Amount (₹)</Label>
                              <Input 
                                type="number"
                                value={newBalance}
                                onChange={(e) => setNewBalance(e.target.value)}
                                className="h-14 bg-slate-50 border-none rounded-2xl px-5 text-lg font-black focus-visible:ring-1 focus-visible:ring-[#312ECB]/20"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <DialogFooter className="flex flex-row gap-3">
                            <Button 
                              variant="outline" 
                              onClick={() => setEditingUser(null)}
                              className="flex-1 h-12 rounded-xl border-slate-200 text-slate-400 font-black uppercase text-[10px] tracking-widest"
                            >
                              <X size={14} className="mr-2" /> Cancel
                            </Button>
                            <Button 
                              onClick={handleUpdateBalance}
                              disabled={isUpdating}
                              className="flex-[2] h-12 bg-[#312ECB] hover:bg-[#2825A6] text-white rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                            >
                              {isUpdating ? <RefreshCw className="animate-spin h-4 w-4" /> : <Save size={16} />}
                              Update Wallet
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
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
