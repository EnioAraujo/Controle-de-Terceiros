"use client";

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OptionManager } from "@/components/OptionManager";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { SelectOption } from "@/types/attendance"; // Re-using SelectOption type

const optionTypes: { key: string; name: string }[] = [
  { key: "fullNameOptions", name: "Nomes Completos dos Terceiros" },
  { key: "shiftOptions", name: "Turnos" },
  { key: "positionOptions", name: "Cargos" },
  { key: "unitOptions", name: "Unidades" },
  { key: "costCenterOptions", name: "Centros de Custo" },
  { key: "reasonOptions", name: "Motivos (Operação)" },
  { key: "supplierOptions", name: "Fornecedores" },
];

const OptionsManagementPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/attendance")}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h2 className="text-2xl font-bold text-center flex-grow">Gerenciar Opções do Formulário</h2>
        </div>
        <p className="text-gray-600 mb-8 text-center">
          Adicione, edite ou remova as opções disponíveis para os campos de seleção do formulário de presença.
        </p>

        <div className="space-y-8">
          {optionTypes.map((type) => (
            <OptionManager
              key={type.key}
              optionTypeKey={type.key}
              optionTypeName={type.name}
            />
          ))}
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default OptionsManagementPage;