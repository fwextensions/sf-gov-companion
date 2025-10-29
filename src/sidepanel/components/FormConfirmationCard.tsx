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
					<div className="font-semibold text-gray-900">
						{formConfirmation.title}
					</div>
				)}
				{formConfirmation.body && (
					<div
						className="text-sm text-gray-700 prose prose-sm max-w-none"
						dangerouslySetInnerHTML={{ __html: formConfirmation.body }}
					/>
				)}
			</div>
		</Card>
	);
};
