"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, differenceInMinutes } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttendanceRecord, SelectOption } from "@/types/attendance";
import { addAttendanceRecord } from "@/lib/attendance-storage";
import { getOptions } from "@/lib/options-storage";
import { showSuccess, showError } from "@/utils/toast";
import { MultiSelect } from "@/components/MultiSelect"; // Import MultiSelect

const formSchema = z.object({
  date: z.date({
    required_error: "A data da presença é obrigatória.",
  }),
  fullName: z.array(z.string()).min(1, "Pelo menos um nome é obrigatório."), // Changed to array for multi-select
  shift: z.string().min(1, "O turno é obrigatório."),
  timeIn: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)."),
  timeOut: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato de hora inválido (HH:MM)."),
  position: z.string().min(1, "O cargo é obrigatório."),
  unit: z.string().min(1, "A unidade é obrigatória."),
  costCenter: z.string().min(1, "O centro de custo é obrigatório."),
  reason: z.string().min(1, "O motivo é obrigatório."),
  supplier: z.string().min(1, "O fornecedor é obrigatório."),
});

// Default options if none are loaded from storage
const defaultFullNameOptions: SelectOption[] = [
  { value: "João Silva", label: "João Silva" },
  { value: "Maria Souza", label: "Maria Souza" },
  { value: "Pedro Santos", label: "Pedro Santos" },
];

const defaultShiftOptions: SelectOption[] = [
  { value: "Manhã", label: "Manhã" },
  { value: "Tarde", label: "Tarde" },
  { value: "Noite", label: "Noite" },
];

const defaultPositionOptions: SelectOption[] = [
  { value: "Operador", label: "Operador" },
  { value: "Supervisor", label: "Supervisor" },
  { value: "Técnico", label: "Técnico" },
  { value: "Engenheiro", label: "Engenheiro" },
];

const defaultUnitOptions: SelectOption[] = [
  { value: "Unidade A", label: "Unidade A" },
  { value: "Unidade B", label: "Unidade B" },
  { value: "Unidade C", label: "Unidade C" },
];

const defaultCostCenterOptions: SelectOption[] = [
  { value: "CC-001", label: "CC-001" },
  { value: "CC-002", label: "CC-002" },
  { value: "CC-003", label: "CC-003" },
];

const defaultReasonOptions: SelectOption[] = [
  { value: "Manutenção", label: "Manutenção" },
  { value: "Produção", label: "Produção" },
  { value: "Limpeza", label: "Limpeza" },
  { value: "Instalação", label: "Instalação" },
];

const defaultSupplierOptions: SelectOption[] = [
  { value: "Empresa X", label: "Empresa X" },
  { value: "Empresa Y", label: "Empresa Y" },
  { value: "Empresa Z", label: "Empresa Z" },
];

interface AttendanceFormProps {
  onOptionsUpdated: () => void; // Callback to trigger re-fetching options
}

export function AttendanceForm({ onOptionsUpdated }: AttendanceFormProps) {
  const [totalHours, setTotalHours] = useState("00:00");
  const [fullNameOptions, setFullNameOptions] = useState<SelectOption[]>(defaultFullNameOptions); // New state for full name options
  const [shiftOptions, setShiftOptions] = useState<SelectOption[]>(defaultShiftOptions);
  const [positionOptions, setPositionOptions] = useState<SelectOption[]>(defaultPositionOptions);
  const [unitOptions, setUnitOptions] = useState<SelectOption[]>(defaultUnitOptions);
  const [costCenterOptions, setCostCenterOptions] = useState<SelectOption[]>(defaultCostCenterOptions);
  const [reasonOptions, setReasonOptions] = useState<SelectOption[]>(defaultReasonOptions);
  const [supplierOptions, setSupplierOptions] = useState<SelectOption[]>(defaultSupplierOptions);

  const loadOptions = useCallback(() => {
    setFullNameOptions(getOptions("fullNameOptions").length > 0 ? getOptions("fullNameOptions") : defaultFullNameOptions); // Load full name options
    setShiftOptions(getOptions("shiftOptions").length > 0 ? getOptions("shiftOptions") : defaultShiftOptions);
    setPositionOptions(getOptions("positionOptions").length > 0 ? getOptions("positionOptions") : defaultPositionOptions);
    setUnitOptions(getOptions("unitOptions").length > 0 ? getOptions("unitOptions") : defaultUnitOptions);
    setCostCenterOptions(getOptions("costCenterOptions").length > 0 ? getOptions("costCenterOptions") : defaultCostCenterOptions);
    setReasonOptions(getOptions("reasonOptions").length > 0 ? getOptions("reasonOptions") : defaultReasonOptions);
    setSupplierOptions(getOptions("supplierOptions").length > 0 ? getOptions("supplierOptions") : defaultSupplierOptions);
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions, onOptionsUpdated]); // Re-load options when onOptionsUpdated is called

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: [], // Default to empty array for multi-select
      shift: "",
      timeIn: "",
      timeOut: "",
      position: "",
      unit: "",
      costCenter: "",
      reason: "",
      supplier: "",
    },
  });

  const { watch } = form;
  const timeIn = watch("timeIn");
  const timeOut = watch("timeOut");

  useEffect(() => {
    if (timeIn && timeOut) {
      try {
        const [inHours, inMinutes] = timeIn.split(":").map(Number);
        const [outHours, outMinutes] = timeOut.split(":").map(Number);

        const date = new Date(); // Use a dummy date for time calculations
        const entryTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), inHours, inMinutes);
        let exitTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), outHours, outMinutes);

        // Handle overnight shifts
        if (exitTime < entryTime) {
          exitTime = new Date(exitTime.getTime() + 24 * 60 * 60 * 1000); // Add 24 hours
        }

        const diffMinutes = differenceInMinutes(exitTime, entryTime);
        if (diffMinutes < 0) {
          setTotalHours("00:00");
          return;
        }

        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        setTotalHours(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
      } catch (error) {
        setTotalHours("00:00");
        console.error("Error calculating total hours:", error);
      }
    } else {
      setTotalHours("00:00");
    }
  }, [timeIn, timeOut]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (values.fullName.length === 0) {
        showError("Selecione pelo menos um nome completo do terceiro.");
        return;
      }

      for (const name of values.fullName) {
        const newRecord: AttendanceRecord = {
          id: crypto.randomUUID(), // Generate a unique ID for each record
          date: values.date,
          fullName: name, // Each record gets one name
          shift: values.shift,
          timeIn: values.timeIn,
          timeOut: values.timeOut,
          totalHours: totalHours,
          position: values.position,
          unit: values.unit,
          costCenter: values.costCenter,
          reason: values.reason,
          supplier: values.supplier,
        };
        addAttendanceRecord(newRecord);
      }
      showSuccess("Registro(s) de presença adicionado(s) com sucesso!");
      form.reset({ // Reset form after successful submission, keeping date if desired
        fullName: [],
        shift: "",
        timeIn: "",
        timeOut: "",
        position: "",
        unit: "",
        costCenter: "",
        reason: "",
        supplier: "",
        date: values.date, // Keep the date selected for convenience
      });
      setTotalHours("00:00"); // Reset total hours
    } catch (error) {
      showError("Erro ao adicionar registro(s) de presença.");
      console.error("Submission error:", error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-6">Controle de Presença de Terceirizados</h2>

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data da Presença</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Completo do Terceiro</FormLabel>
              <FormControl>
                <MultiSelect
                  options={fullNameOptions}
                  selected={field.value}
                  onChange={field.onChange}
                  placeholder="Selecione os nomes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shift"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Turno</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o turno" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {shiftOptions.map((option) => (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="timeIn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora de Entrada</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timeOut"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora de Saída</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormItem>
          <FormLabel>Total de Horas Trabalhadas</FormLabel>
          <FormControl>
            <Input value={totalHours} readOnly className="bg-gray-100 cursor-not-allowed" />
          </FormControl>
        </FormItem>

        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cargo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {positionOptions.map((option) => (
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
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unidade</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {unitOptions.map((option) => (
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
          name="costCenter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Centro de Custo</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {costCenterOptions.map((option) => (
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
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo (Operação)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {reasonOptions.map((option) => (
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
          name="supplier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fornecedor</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {supplierOptions.map((option) => (
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

        <Button type="submit" className="w-full">
          Registrar Presença
        </Button>
      </form>
    </Form>
  );
}