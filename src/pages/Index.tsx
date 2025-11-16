import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold mb-4">Bem-vindo ao Controle de Terceiros</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Gerencie a presença de seus colaboradores terceirizados de forma eficiente.
        </p>
        <Link to="/attendance">
          <Button className="px-8 py-4 text-lg">
            Ir para o Controle de Presença
          </Button>
        </Link>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;