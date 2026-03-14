"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, differenceInMinutes } from "date-fns";
import { CalendarIcon, ChevronsUpDown, PlusCircle, MinusCircle } from "lucide-react"; // Added PlusCircle and MinusCircle icons

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
import { getOptions, saveOptions } from "@/lib/options-storage";
import { showSuccess, showError } from "@/utils/toast";
import { MultiSelect } from "@/components/MultiSelect";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // Import Collapsible components

const formSchema = z.object({
  date: z.date({
    required_error: "A data da presença é obrigatória.",
  }),
  fullName: z.array(z.string()).min(1, "Pelo menos um nome é obrigatório."),
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
  onOptionsUpdated: () => void;
}

export function AttendanceForm({ onOptionsUpdated }: AttendanceFormProps) {
  const [totalHours, setTotalHours] = useState("00:00");
  const [fullNameOptions, setFullNameOptions] = useState<SelectOption[]>(defaultFullNameOptions);
  const [shiftOptions, setShiftOptions] = useState<SelectOption[]>(defaultShiftOptions);
  const [positionOptions, setPositionOptions] = useState<SelectOption[]>(defaultPositionOptions);
  const [unitOptions, setUnitOptions] = useState<SelectOption[]>(defaultUnitOptions);
  const [costCenterOptions, setCostCenterOptions] = useState<SelectOption[]>(defaultCostCenterOptions);
  const [reasonOptions, setReasonOptions] = useState<SelectOption[]>(defaultReasonOptions);
  const [supplierOptions, setSupplierOptions] = useState<SelectOption[]>(defaultSupplierOptions);
  const [newManualFullName, setNewManualFullName] = useState("");
  const [isAddingNameOpen, setIsAddingNameOpen] = useState(false); // State for collapsible

  const loadOptions = useCallback(async () => {
    try {
      const [full, shift, pos, unit, cc, reason, supplier] = await Promise.all([
        getOptions("fullNameOptions"),
        getOptions("shiftOptions"),
        getOptions("positionOptions"),
        getOptions("unitOptions"),
        getOptions("costCenterOptions"),
        getOptions("reasonOptions"),
        getOptions("supplierOptions"),
      ]);
      setFullNameOptions(full.length     > 0 ? full     : defaultFullNameOptions);
      setShiftOptions(shift.length       > 0 ? shift    : defaultShiftOptions);
      setPositionOptions(pos.length      > 0 ? pos      : defaultPositionOptions);
      setUnitOptions(unit.length         > 0 ? unit     : defaultUnitOptions);
      setCostCenterOptions(cc.length     > 0 ? cc       : defaultCostCenterOptions);
      setReasonOptions(reason.length     > 0 ? reason   : defaultReasonOptions);
      setSupplierOptions(supplier.length > 0 ? supplier : defaultSupplierOptions);
    } catch (err) {
      console.error("Erro ao carregar opções:", err);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions, onOptionsUpdated]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: [],
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

        const date = new Date();
        const entryTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), inHours, inMinutes);
        let exitTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), outHours, outMinutes);

        if (exitTime < entryTime) {
          exitTime = new Date(exitTime.getTime() + 24 * 60 * 60 * 1000);
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

  const handleAddManualFullName = async () => {
    const trimmedName = newManualFullName.trim();
    if (!trimmedName) {
      showError("O nome não pode ser vazio.");
      return;
    }

    const existingOptions = await getOptions("fullNameOptions");
    const isAlreadyAdded = existingOptions.some(
      (option) => option.value.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isAlreadyAdded) {
      showError("Este nome já existe na lista.");
      return;
    }

    const newOption: SelectOption = { value: trimmedName, label: trimmedName };
    const updatedOptions = [...existingOptions, newOption];
    try {
      await saveOptions("fullNameOptions", updatedOptions);
      setFullNameOptions(updatedOptions);
      setNewManualFullName("");
      showSuccess(`Nome "${trimmedName}" adicionado com sucesso!`);
      onOptionsUpdated();
    } catch (err) {
      showError("Erro ao adicionar nome.");
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (values.fullName.length === 0) {
        showError("Selecione pelo menos um nome completo do terceiro.");
        return;
      }

      for (const name of values.fullName) {
        const newRecord: AttendanceRecord = {
          id: crypto.randomUUID(),
          date: values.date,
          fullName: name,
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
        await addAttendanceRecord(newRecord);
      }
      showSuccess("Registro(s) de presença adicionado(s) com sucesso!");
      form.reset({
        fullName: [],
        shift: "",
        timeIn: "",
        timeOut: "",
        position: "",
        unit: "",
        costCenter: "",
        reason: "",
        supplier: "",
        date: values.date,
      });
      setTotalHours("00:00");
    } catch (error) {
      showError("Erro ao adicionar registro(s) de presença.");
      console.error("Submission error:", error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
        {/* <h2 className="text-2xl font-bold text-center mb-6">Controle de Presença de Terceirizados</h2> */} {/* Removed the title */}

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

        {/* Collapsible for Manual Full Name Input */}
        <Collapsible
          open={isAddingNameOpen}
          onOpenChange={setIsAddingNameOpen}
          className="w-full space-y-2"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Adicionar novo nome manualmente
            </h4>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {isAddingNameOpen ? <MinusCircle className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-2">
            <div className="flex items-end space-x-2">
              <div className="flex-grow">
                <FormItem>
                  <Input
                    id="new-full-name"
                    placeholder="Digite um novo nome completo"
                    value={newManualFullName}
                    onChange={(e) => setNewManualFullName(e.target.value)}
                  />
                </FormItem>
              </div>
              <Button type="button" onClick={handleAddManualFullName}>
                Adicionar
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

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