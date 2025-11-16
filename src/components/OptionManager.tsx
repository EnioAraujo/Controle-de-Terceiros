"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Pencil, Trash2, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SelectOption } from "@/types/attendance";
import { getOptions, saveOptions } from "@/lib/options-storage";
import { showSuccess, showError } from "@/utils/toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface OptionManagerProps {
  optionTypeKey: string;
  optionTypeName: string;
}

const formSchema = z.object({
  newOption: z.string().min(1, "A opção não pode ser vazia."),
});

const editFormSchema = z.object({
  editedOption: z.string().min(1, "A opção não pode ser vazia."),
});

export function OptionManager({ optionTypeKey, optionTypeName }: OptionManagerProps) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEditingOption, setCurrentEditingOption] = useState<SelectOption | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newOption: "",
    },
  });

  const editForm = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      editedOption: "",
    },
  });

  useEffect(() => {
    loadOptions();
  }, [optionTypeKey]);

  const loadOptions = () => {
    setOptions(getOptions(optionTypeKey));
  };

  const handleAddOption = (values: z.infer<typeof formSchema>) => {
    const trimmedValue = values.newOption.trim();
    if (!trimmedValue) return;

    if (options.some(opt => opt.value.toLowerCase() === trimmedValue.toLowerCase())) {
      showError("Esta opção já existe.");
      return;
    }

    const newOption: SelectOption = { value: trimmedValue, label: trimmedValue };
    const updatedOptions = [...options, newOption];
    saveOptions(optionTypeKey, updatedOptions);
    setOptions(updatedOptions);
    form.reset();
    showSuccess(`Opção "${trimmedValue}" adicionada.`);
  };

  const handleEditOption = (oldValue: string, newLabel: string) => {
    const trimmedNewLabel = newLabel.trim();
    if (!trimmedNewLabel) {
      showError("A opção editada não pode ser vazia.");
      return;
    }

    if (options.some(opt => opt.value.toLowerCase() === trimmedNewLabel.toLowerCase() && opt.value !== oldValue)) {
      showError("Já existe uma opção com este nome.");
      return;
    }

    const updatedOptions = options.map(opt =>
      opt.value === oldValue ? { value: trimmedNewLabel, label: trimmedNewLabel } : opt
    );
    saveOptions(optionTypeKey, updatedOptions);
    setOptions(updatedOptions);
    setIsEditDialogOpen(false);
    showSuccess(`Opção "${oldValue}" atualizada para "${trimmedNewLabel}".`);
  };

  const handleDeleteOption = (valueToDelete: string) => {
    const updatedOptions = options.filter(opt => opt.value !== valueToDelete);
    saveOptions(optionTypeKey, updatedOptions);
    setOptions(updatedOptions);
    showSuccess(`Opção "${valueToDelete}" removida.`);
  };

  const openEditDialog = (option: SelectOption) => {
    setCurrentEditingOption(option);
    editForm.setValue("editedOption", option.label);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-xl font-semibold">{optionTypeName}</h3>

      {/* Add New Option Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleAddOption)} className="flex space-x-2">
          <FormField
            control={form.control}
            name="newOption"
            render={({ field }) => (
              <FormItem className="flex-grow">
                <FormControl>
                  <Input placeholder={`Adicionar novo ${optionTypeName.toLowerCase().slice(0, -1)}`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="icon">
            <PlusCircle className="h-4 w-4" />
            <span className="sr-only">Adicionar</span>
          </Button>
        </form>
      </Form>

      {/* Options Table */}
      {options.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opção</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.map((option) => (
              <TableRow key={option.value}>
                <TableCell className="font-medium">{option.label}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(option)}
                    className="mr-2"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Isso removerá a opção "{option.label}"
                          permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteOption(option.value)}>
                          Continuar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-center text-gray-500">Nenhuma opção cadastrada.</p>
      )}

      {/* Edit Option Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Opção</DialogTitle>
            <DialogDescription>
              Edite o valor da opção selecionada.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((values) =>
                handleEditOption(currentEditingOption!.value, values.editedOption)
              )}
              className="grid gap-4 py-4"
            >
              <FormField
                control={editForm.control}
                name="editedOption"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opção</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit">Salvar mudanças</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}