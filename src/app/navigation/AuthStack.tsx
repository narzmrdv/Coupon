import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import RegisterScreen from '../../pages/auth/RegisterScreen';
import LoginScreen from '../../pages/auth/LoginScreen';
import VerifyEmailScreen from '../../pages/auth/VerifyEmailScreen';
import ForgotPasswordScreen from '../../pages/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../../pages/auth/ResetPasswordScreen';
import { withScreenErrorBoundary } from '../../shared/ui/ScreenErrorBoundary';

const SafeLoginScreen = withScreenErrorBoundary(LoginScreen);
const SafeRegisterScreen = withScreenErrorBoundary(RegisterScreen);
const SafeVerifyEmailScreen = withScreenErrorBoundary(VerifyEmailScreen);
const SafeForgotPasswordScreen = withScreenErrorBoundary(ForgotPasswordScreen);
const SafeResetPasswordScreen = withScreenErrorBoundary(ResetPasswordScreen);

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
      initialRouteName="Login">
      <Stack.Screen name="Login" component={SafeLoginScreen} />
      <Stack.Screen name="Register" component={SafeRegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={SafeVerifyEmailScreen} />
      <Stack.Screen name="ForgotPassword" component={SafeForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={SafeResetPasswordScreen} />
    </Stack.Navigator>
  );
}
