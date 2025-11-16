"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
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
import { MadeWithDyad } from "@/components/made-with-dyad";

const optionTypes: SelectOption[] = [
  { value: "shiftOptions", label: "Turno" },
  { value: "positionOptions", label: "Cargo" },
  { value: "unitOptions", label: "Unidade" },
  { value: "costCenterOptions", label: "Centro de Custo" },
  { value: "reasonOptions", label: "Motivo (Operação)" },
  { value: "supplierOptions", label: "Fornecedor" },
];

const formSchema = z.object({
  optionType: z.string().min(1, "Selecione o tipo de opção."),
  optionsText: z.string().min(1, "Insira as opções, uma por linha."),
});

const ManualOptionsInputPage = () => {
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      optionType: "",
      optionsText: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const optionTypeKey = values.optionType;
    const optionsText = values.optionsText;

    const parsedOptions: SelectOption[] = optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((line) => ({ value: line, label: line }));

    if (parsedOptions.length > 0) {
      saveOptions(optionTypeKey, parsedOptions);
      showSuccess(`Opções de ${optionTypes.find(o => o.value === optionTypeKey)?.label} salvas com sucesso!`);
      form.reset();
      navigate("/attendance"); // Navigate back to attendance page to see updated options
    } else {
      showError("Nenhuma opção válida encontrada para salvar.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/attendance")}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h2 className="text-2xl font-bold text-center flex-grow">Inserir Opções Manualmente</h2>
        </div>
        <p className="text-gray-600 mb-6 text-center">
          Cole sua lista de opções abaixo, uma por linha, e selecione o tipo de campo ao qual elas pertencem.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              name="optionsText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opções (uma por linha)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Cole suas opções aqui, uma por linha..."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Salvar Opções
            </Button>
          </form>
        </Form>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ManualOptionsInputPage;