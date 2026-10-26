export interface IUserData {
  email: string;
  name: string;
  phoneNumber: string;
  age: number;
  gender: "Male" | "Female";
}

export interface IAuthData extends IUserData {
  password: string;
}
