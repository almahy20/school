import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("❌ Uncaught error in GlobalErrorBoundary:", error, errorInfo);
    
    // Here we could send the error to an external logging service
    // like Sentry, LogRocket, or our own backend endpoint.
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen-safe bg-[#060b16] flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <div className="w-24 h-24 rounded-[40px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-8 animate-pulse">
            <AlertCircle className="w-12 h-12 text-rose-500" />
          </div>
          
          <h1 className="text-3xl font-black text-white mb-4 tracking-tight">عذراً، حدث خطأ غير متوقع</h1>
          <p className="text-white/40 text-lg font-medium max-w-md mx-auto mb-10 leading-relaxed">
            لقد واجه النظام مشكلة تقنية عارضة. لا تقلق، بياناتك آمنة، يمكنك محاولة تحديث الصفحة أو العودة للرئيسية.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button 
              onClick={this.handleReload}
              className="h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base shadow-xl shadow-indigo-600/20 flex items-center gap-3"
            >
              <RefreshCw className="w-5 h-5" />
              تحديث الصفحة
            </Button>
            
            <Button 
              onClick={this.handleReset}
              variant="outline"
              className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 text-white font-bold text-base hover:bg-white/10 flex items-center gap-3"
            >
              <Home className="w-5 h-5" />
              العودة للرئيسية
            </Button>
          </div>
          
          {import.meta.env.DEV && (
            <div className="mt-12 p-6 rounded-3xl bg-white/5 border border-white/10 text-right max-w-2xl w-full overflow-auto">
              <p className="text-rose-400 font-mono text-xs mb-2">Technical Details (Dev Only):</p>
              <code className="text-white/60 text-[10px] font-mono whitespace-pre-wrap">
                {this.state.error?.stack}
              </code>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
