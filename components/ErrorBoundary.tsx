import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleResetData = () => {
    if (window.confirm("Hành động này sẽ XÓA TOÀN BỘ dữ liệu trên máy để khắc phục lỗi. Bạn cần đồng bộ lại từ Cloud sau đó. Tiếp tục?")) {
        localStorage.clear();
        window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center border border-slate-200">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-black text-slate-800 mb-2 uppercase">Ứng dụng gặp sự cố</h1>
            <p className="text-slate-500 mb-4 text-sm">
              Đã xảy ra lỗi nghiêm trọng trong quá trình xử lý dữ liệu.
            </p>
            <div className="bg-slate-100 p-3 rounded text-xs font-mono text-red-600 mb-6 text-left overflow-auto max-h-32 border border-slate-200">
                {this.state.error?.message}
            </div>
            
            <div className="flex flex-col gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Tải Lại Trang
                </button>
                <button
                  onClick={this.handleResetData}
                  className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Reset Dữ Liệu Gốc
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}