import { AttendanceForm } from "@/components/AttendanceForm";
import { MadeWithDyad } from "@/components/made-with-dyad";

const AttendancePage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <AttendanceForm />
      <MadeWithDyad />
    </div>
  );
};

export default AttendancePage;