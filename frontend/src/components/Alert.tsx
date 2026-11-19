import * as AlertDialogPrimitive from "@rn-primitives/alert-dialog";
import { ReactNode } from "react";
import { Text } from "react-native";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";

interface IProps {
  triggerComponent: ReactNode;
  children: ReactNode;
  title: string;
  description?: string;
}

export default function Alert({
  triggerComponent,
  title,
  children,
  description,
}: IProps) {
  return (
    <Dialog>
      <DialogTrigger className="flex-row items-center gap-x-2 ">
        {triggerComponent}
      </DialogTrigger>

      <DialogContent
        overlayClassName="bg-transparent"
        className="bg-background border-border items-center p-4"
        style={
          {
            //   width: dialogWidth,
            //   maxWidth: windowWidth - 32,
          }
        }
        showCloseButton={false}
      >
        <DialogTitle>{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
