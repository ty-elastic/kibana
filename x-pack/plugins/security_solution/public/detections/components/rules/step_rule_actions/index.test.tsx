/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { shallow } from 'enzyme';

import { StepRuleActions } from '.';

jest.mock('../../../../common/lib/kibana', () => ({
  useKibana: jest.fn().mockReturnValue({
    services: {
      application: {
        getUrlForApp: jest.fn(),
        capabilities: {
          siem: {
            crud: true,
          },
          actions: {
            read: true,
          },
        },
      },
      triggersActionsUi: {
        actionTypeRegistry: jest.fn(),
      },
    },
  }),
}));

jest.mock('../../../../common/hooks/use_experimental_features', () => ({
  useIsExperimentalFeatureEnabled: jest.fn().mockReturnValue(false),
}));

const actionMessageParams = {
  context: [],
  state: [],
  params: [],
};

describe('StepRuleActions', () => {
  it('renders correctly', () => {
    const wrapper = shallow(
      <StepRuleActions
        actionMessageParams={actionMessageParams}
        summaryActionMessageParams={actionMessageParams}
        isReadOnlyView={false}
        isLoading={false}
      />
    );

    expect(wrapper.find('[data-test-subj="stepRuleActions"]')).toHaveLength(1);
  });
});
