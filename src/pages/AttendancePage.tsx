import React, { useState, useCallback } from "react";
import { AttendanceForm } from "@/components/AttendanceForm";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { ImportOptionsDialog } from "@/components/ImportOptionsDialog";
import { Link } from "react-router-dom";

const AttendancePage = () => {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [optionsUpdatedKey, setOptionsUpdatedKey] = useState(0); // Used to force AttendanceForm to re-fetch options

  const handleImportSuccess = useCallback(() => {
    setOptionsUpdatedKey(prev => prev + 1); // Increment key to trigger re-fetch in AttendanceForm
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto mb-6 flex justify-end gap-4">
        <Link to="/manual-options-input">
          <Button variant="outline">
            Inserir Opções Manualmente
          </Button>
        </Link>
        <Button onClick={() => setIsImportDialogOpen(true)}>
          Importar Opções
        </Button>
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