import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import * as React from "react";
import { Pressable, View } from "react-native";

interface IProps {
  title: string;
  description: string;
  children: React.ReactNode;
  buttonText: string;
  redirection?: boolean;
  redirectionText?: string;
  redirectionLinkName?: string;
  onRedirection?: () => void;
  onSubmit: () => void;
}

export function Modal({
  title,
  description,
  children,
  buttonText,
  redirection,
  onSubmit,
  redirectionText,
  redirectionLinkName,
  onRedirection,
}: IProps) {
  return (
    <View className="gap-6 ">
      <Card className="border-border/0 sm:border-border shadow-none sm:shadow-sm sm:shadow-black/5 py-10">
        <CardHeader>
          <CardTitle className="text-center text-xl sm:text-left">
            {title}
          </CardTitle>
          <CardDescription className="text-center sm:text-left">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-6">
          <View className="gap-6">
            {children}
            <Button className="w-full" onPress={onSubmit}>
              <Text>{buttonText}</Text>
            </Button>
          </View>

          {redirection && (
            <View className="flex flex-row items-center  justify-center py-2">
              <Text className="text-center text-sm ">{redirectionText}</Text>
              <Pressable onPress={onRedirection}>
                <Text className="text-sm ml-1 underline underline-offset-2 ">
                  {redirectionLinkName}
                </Text>
              </Pressable>
            </View>
          )}
        </CardContent>
      </Card>
    </View>
  );
}
