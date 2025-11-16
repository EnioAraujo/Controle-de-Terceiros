import React, { useState, useCallback } from "react";
import { AttendanceForm } from "@/components/AttendanceForm";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { ImportOptionsDialog } from "@/components/ImportOptionsDialog";
import { OptionsSheet } from "@/components/OptionsSheet"; // Importando o novo componente

const AttendancePage = () => {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [optionsUpdatedKey, setOptionsUpdatedKey] = useState(0); // Usado para forçar o AttendanceForm a recarregar as opções

  const handleImportSuccess = useCallback(() => {
    setOptionsUpdatedKey(prev => prev + 1); // Incrementa a chave para disparar o re-fetch no AttendanceForm
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-10 relative">
      <div className="absolute top-4 left-4 z-10"> {/* Posiciona o gatilho do menu retrátil */}
        <OptionsSheet onImportClick={() => setIsImportDialogOpen(true)} />
      </div>
      <AttendanceForm onOptionsUpdated={handleImportSuccess} key={optionsUpdatedKey} />
      <MadeWithDyad />

      <ImportOptionsDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default AttendancePage;