import { useContext } from "react";
import { Ctx } from "@/lib/i18n-context";

export const useI18n = () => useContext(Ctx);
