import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface IframeWarningModalProps {
  isOpen: boolean;
  onProceed: () => void;
  onCancel: () => void;
}

export const IframeWarningModal: React.FC<IframeWarningModalProps> = ({
  isOpen,
  onProceed,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col space-y-5 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center space-x-3 text-amber-400">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <h2 className="text-lg font-semibold text-white">ข้อควรระวัง: โหมด iFrame (Preview)</h2>
        </div>
        
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <p>
            ระบบตรวจพบว่าคุณกำลังใช้งานผ่านหน้าต่าง <strong>Preview</strong> ของ AI Studio 
            ซึ่งมีข้อจำกัดด้านความปลอดภัย ทำให้ไม่สามารถเลือก "โฟลเดอร์สำหรับบันทึกไฟล์โดยตรง" ได้
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-amber-200/90 text-xs">
            <strong>ผลกระทบ:</strong> แอปจะสลับไปใช้ <strong>"โหมดแคชชั่วคราว"</strong> 
            แทน ซึ่งอาจดึงพื้นที่ SSD ของคุณมาช่วยประมวลผลหากขนาดไฟล์ใหญ่เกินกว่า RAM จะรับไหว
          </div>
          <p className="flex items-center space-x-2 text-indigo-300 font-medium">
            <ExternalLink className="w-4 h-4" />
            <span>คำแนะนำ: ให้คลิก "Open in New Tab" ที่มุมขวาบนเพื่อการทำงานที่ดีที่สุด</span>
          </p>
        </div>

        <div className="flex space-x-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition border border-white/10"
          >
            ยกเลิก
          </button>
          <button
            onClick={onProceed}
            className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-amber-600/20"
          >
            ใช้โหมดแคชต่อไป
          </button>
        </div>
      </div>
    </div>
  );
};
