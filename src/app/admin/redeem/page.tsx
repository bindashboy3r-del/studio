
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  Ticket, 
  Plus, 
  Trash2, 
  RefreshCw,
  Save,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";

export default function RedeemManagerPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isAdding, setIsAdding] = useState(false);
  const [newCode, setNewCode] = useState({ code: "", amount: "", limit: "" });
  const [isSaving, setIsSaving] = useState(false);

  const codesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "redeemCodes"), orderBy("createdAt", "desc"));
  }, [db]);
  const { data: codes, isLoading: isCodesLoading } = useCollection(codesQuery);

  useEffect(() => {
    const ADMIN_EMAIL = "chetanmadhav4@gmail.com";
    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push("/admin/login");
    }
  }, [user, isUserLoading, router]);

  const handleAddCode = async () => {
    if (!db || !newCode.code || !newCode.amount || !newCode.limit) {
      toast({ variant: "destructive", title: "Missing Fields" });
      return;
    }

    setIsSaving(true);
    const codeId = newCode.code.trim().toUpperCase();
    try {
      await setDoc(doc(db, "redeemCodes", codeId), {
        code: codeId,
        amount: parseFloat(newCode.amount),
        limit: parseInt(newCode.limit),
        usedCount: 0,
        usedBy: [],
        createdAt: serverTimestamp(),
        createdBy: user?.email
      });
      toast({ title: "Code Created!", description: `${codeId} is now active.` });
      setNewCode({ code: "", amount: "", limit: "" });
      setIsAdding(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to create code" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("Are you sure you want to delete this code?")) return;
    try {
      await deleteDoc(doc(db, "redeemCodes", id));
      toast({ title: "Deleted" });
    } catch (e) {
      toast({ variant: "destructive", title: "Deletion failed" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-body pb-20">
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-[#111B21] uppercase">Redeem Codes</h1>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button className="bg-[#312ECB] hover:bg-[#2825A6] rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
              <Plus size={16} /> New Code
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-slate-900">
                <Ticket className="text-[#312ECB]" /> Create Voucher
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Redeem Code (Unique)</label>
                <Input 
                  placeholder="e.g. FREE100" 
                  value={newCode.code} 
                  onChange={e => setNewCode({...newCode, code: e.target.value.toUpperCase()})}
                  className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Amount (₹)</label>
                  <Input 
                    type="number" 
                    placeholder="100" 
                    value={newCode.amount} 
                    onChange={e => setNewCode({...newCode, amount: e.target.value})}
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Usage Limit</label>
                  <Input 
                    type="number" 
                    placeholder="10" 
                    value={newCode.limit} 
                    onChange={e => setNewCode({...newCode, limit: e.target.value})}
                    className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-slate-900" 
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleAddCode} 
                disabled={isSaving}
                className="w-full h-14 bg-[#312ECB] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg"
              >
                {isSaving ? "Creating..." : "Save & Activate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {isCodesLoading ? (
          <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-[#312ECB]" /></div>
        ) : codes && codes.length > 0 ? (
          <div className="grid gap-4">
            {codes.map((c: any) => (
              <div key={c.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between group">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shadow-inner">
                    <Ticket size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-slate-900">{c.code}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] font-black text-emerald-600 uppercase">Amount: ₹{c.amount}</span>
                      <span className="text-slate-200">|</span>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                        <Users size={12} /> {c.usedCount} / {c.limit} Used
                      </div>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleDelete(c.id)}
                  className="text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center space-y-4">
            <Ticket size={48} className="mx-auto text-slate-200" />
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">No active redeem codes</p>
          </div>
        )}
      </main>
    </div>
  );
}
