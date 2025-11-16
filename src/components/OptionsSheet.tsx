"use client";

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface OptionsSheetProps {
  onImportClick: () => void;
}

export function OptionsSheet({ onImportClick }: OptionsSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleImportClick = () => {
    onImportClick();
    setIsOpen(false); // Fecha o menu após clicar em importar
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Menu className="h-4 w-4" />
          Opções
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[240px] sm:w-[280px]">
        <SheetHeader>
          <SheetTitle>Gerenciar Opções</SheetTitle>
          <SheetDescription>
            Acesse as ferramentas para gerenciar as opções do formulário.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 py-6">
          <Link to="/manual-options-input" onClick={() => setIsOpen(false)}>
            <Button variant="ghost" className="w-full justify-start">
              Inserir Opções Manualmente
            </Button>
          </Link>
          <Button variant="ghost" className="w-full justify-start" onClick={handleImportClick}>
            Importar Opções
          </Button>
          <Link to="/manage-options" onClick={() => setIsOpen(false)}>
            <Button variant="ghost" className="w-full justify-start">
              Gerenciar Opções
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}