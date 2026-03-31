import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useI18n } from "@/hooks/use-i18n";

const NotFound = () => {
  const location = useLocation();
  const { lang } = useI18n();

  useEffect(() => {
    if (import.meta.env.DEV) console.error("[404]", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">
          {lang === "pt-BR" ? "Ops! Página não encontrada" : "Oops! Page not found"}
        </p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          {lang === "pt-BR" ? "Voltar ao início" : "Return to Home"}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
