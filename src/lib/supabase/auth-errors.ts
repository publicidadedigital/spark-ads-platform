export function translateAuthError(message: string | null | undefined): string {
  if (!message) return "Ocorreu um erro inesperado. Tente novamente.";

  if (/already registered|already exists|already been registered/i.test(message)) {
    return "Este e-mail ja esta cadastrado.";
  }

  if (/Password should contain at least one character of each/i.test(message)) {
    return "A senha precisa ter pelo menos 8 caracteres e incluir letra maiuscula, letra minuscula, numero e um caractere especial (ex: ! @ # $ % & *).";
  }

  const minLength = message.match(/Password should be at least (\d+) characters/i);
  if (minLength) {
    return `A senha precisa ter no minimo ${minLength[1]} caracteres.`;
  }

  if (/should be different from the old password/i.test(message)) {
    return "A nova senha precisa ser diferente da senha atual.";
  }

  if (/Invalid login credentials/i.test(message)) {
    return "E-mail ou senha incorretos.";
  }

  if (/Email not confirmed/i.test(message)) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }

  if (/Unable to validate email address/i.test(message)) {
    return "E-mail invalido.";
  }

  if (/rate limit/i.test(message)) {
    return "Muitas tentativas em sequencia. Aguarde um instante e tente novamente.";
  }

  return message;
}
