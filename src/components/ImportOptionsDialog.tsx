"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectOption } from "@/types/attendance";
import { saveOptions } from "@/lib/options-storage";
import { showSuccess, showError } from "@/utils/toast";

interface ImportOptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const optionTypes: SelectOption[] = [
  { value: "fullNameOptions", label: "Nome Completo do Terceiro" }, // Added new option type
  { value: "shiftOptions", label: "Turno" },
  { value: "positionOptions", label: "Cargo" },
  { value: "unitOptions", label: "Unidade" },
  { value: "costCenterOptions", label: "Centro de Custo" },
  { value: "reasonOptions", label: "Motivo (Operação)" },
  { value: "supplierOptions", label: "Fornecedor" },
];

const formSchema = z.object({
  optionType: z.string().min(1, "Selecione o tipo de opção."),
  file: z.any().refine((file) => file instanceof File, "Um arquivo é obrigatório."),
});

export function ImportOptionsDialog({ isOpen, onClose, onImportSuccess }: ImportOptionsDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      form.setValue("file", event.target.files[0]);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const file = values.file as File;
    const optionTypeKey = values.optionType;

    try {
      let parsedOptions: SelectOption[] = [];

      if (file.name.endsWith(".xlsx")) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Assuming the first column contains the values
        if (json.length > 1) { // Skip header row if present
          parsedOptions = json.slice(1).map((row: any) => ({
            value: String(row[0]).trim(),
            label: String(row[0]).trim(),
          })).filter(option => option.value !== "");
        } else if (json.length === 1 && json[0].length > 0) { // Handle case with no header
          parsedOptions = json[0].map((value: any) => ({
            value: String(value).trim(),
            label: String(value).trim(),
          })).filter(option => option.value !== "");
        }

      } else if (file.name.endsWith(".txt")) {
        const text = await file.text();
        parsedOptions = text.split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "")
          .map((line) => ({ value: line, label: line }));
      } else {
        showError("Formato de arquivo não suportado. Use .xlsx ou .txt.");
        return;
      }

      if (parsedOptions.length > 0) {
        saveOptions(optionTypeKey, parsedOptions);
        showSuccess(`Opções de ${optionTypes.find(o => o.value === optionTypeKey)?.label} importadas com sucesso!`);
        onImportSuccess();
        onClose();
      } else {
        showError("Nenhuma opção válida encontrada no arquivo.");
      }
    } catch (error) {
      console.error("Erro ao importar opções:", error);
      showError("Erro ao importar opções. Verifique o formato do arquivo.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Importar Opções</DialogTitle>
          <DialogDescription>
            Importe uma lista de opções para os campos de seleção do formulário.
            O arquivo deve conter uma lista de valores, um por linha para .txt ou na primeira coluna para .xlsx.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="optionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Opção</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de opção" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {optionTypes.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="file"
              render={() => (
                <FormItem>
                  <FormLabel>Arquivo (.xlsx ou .txt)</FormLabel>
                  <FormControl>
                    <Input type="file" onChange={handleFileChange} accept=".xlsx,.txt" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Importar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}