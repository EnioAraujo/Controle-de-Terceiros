import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface FornecedorErrorBannerProps {
  mensagem: string;
  onRetry?: () => void;
}

/**
 * Banner de erro reutilizável para /fornecedor e /fornecedor/mobile.
 * Acessível (role=alert via shadcn Alert) e desacoplado das páginas.
 */
export function FornecedorErrorBanner({ mensagem, onRetry }: FornecedorErrorBannerProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Falha ao carregar dados</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{mensagem}</span>
        {onRetry && (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              aria-label="Tentar novamente"
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
