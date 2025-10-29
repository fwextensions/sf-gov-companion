import React from "react";
import { Card } from "./Card";
import type { FormConfirmation } from "../../types/wagtail";

interface FormConfirmationCardProps {
	formConfirmation: FormConfirmation;
}

export const FormConfirmationCard: React.FC<FormConfirmationCardProps> = ({
	formConfirmation
}) => {
	return (
		<Card title="Form Confirmation">
			<div className="space-y-3">
				{formConfirmation.title && (
					<div className="mt-2 font-semibold text-gray-700 text-[1.25em]">
						{formConfirmation.title}
					</div>
				)}
				{formConfirmation.body && (
					<div
						className="text-sm text-gray-700 max-w-none form-confirmation"
						dangerouslySetInnerHTML={{ __html: formConfirmation.body }}
					/>
				)}
			</div>
		</Card>
	);
};
