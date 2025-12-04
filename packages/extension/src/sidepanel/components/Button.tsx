import { ReactNode } from "react";

interface ButtonProps {
	onClick?: () => void;
	disabled?: boolean;
	className?: string;
	children?: ReactNode;
}

export function Button(
	props: ButtonProps)
{
	const {
		onClick = () => {},
		disabled = false,
		className = "",
		children,
	} = props;

	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={`inline-flex items-center gap-2 rounded-lg bg-sfgov-blue px-4 py-2 text-sm font-medium text-white shadow hover:bg-sfgov-blue-hover cursor-pointer focus:outline-none focus:ring-2 focus:ring-sfgov-blue focus:ring-offset-2 ${className}`}
		>
			{children}
		</button>
	)
}
